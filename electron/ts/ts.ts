import StreamZip from 'node-stream-zip';
import fetch from 'node-fetch';
import path from 'node:path';
import fs from 'node:fs';
import archiver from 'archiver';
import { STORE } from '../main';
import { IProgress } from '../../types/interfaces';
import { ipcMain } from 'electron';
import crypto from 'crypto';
import { deleteAsync } from 'del';

interface IMRPack {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  files: {
    path: string;
    hashes: {
      sha1: string;
      sha512: string;
    };
    downloads: string[];
    fileSize: number;
  }[];
  dependencies: { [key: string]: string };
}

interface IManifest {
  minecraft: {
    version: string;
    modLoaders: {
      id: string;
      primary: boolean;
    }[];
  };

  manifestType: string;
  manifestVersion: number;
  minecraftVersion: string;
  name: string;
  version: string;
  author: string;

  files: {
    projectID: number;
    fileID: number;
    size: number;
    hashes: {
      sha1: string;
      sha512: string;
    };
    required: boolean;
  }[];

  overrides: string;
}

const handleCleanup = async (modpackFolder: string) => {
  // Delete the modpack folder
  await deleteAsync(modpackFolder, {
    force: true,
  });

  // Reset the progress
  ipcMain.emit('set:download:progress', {
    isDownloading: false,
    current: 0,
    total: 0,
  } as IProgress);

  ipcMain.emit('set:download:complete', false);
  STORE.set('isDownloading', false);
};

export const handleModpackDownload = async (
  zipFile: string,
  directory: string
) => {
  ipcMain.emit('set:download:complete', false);
  STORE.set('isDownloading', true);
  STORE.set('downloadProgressCurrent', 0);
  STORE.set('downloadProgressTotal', 0);
  console.log('Downloading modpack...');
  console.log(zipFile);
  console.log(directory);

  // Read the zip file
  const zip = new StreamZip({
    file: zipFile,
    storeEntries: true,
  });

  // Read manifest.json in the zip file
  zip.on('ready', async () => {
    // Log the entries in the zip file
    console.log('Entries read: ' + zip.entriesCount);
    console.log('Entries: ' + Object.keys(zip.entries()));

    // Check if manifest.json exists in the zip file
    if (zip.entry('manifest.json')) {
      // Extract the manifest.json file
      const manifest = zip.entryDataSync('manifest.json').toString('utf8');
      console.log(manifest);

      const manifestData = JSON.parse(manifest) as IManifest;
      console.log(manifestData);

      // Create folder name of the modpack "name"
      const modpackFolder = path.join(directory, manifestData.name);

      // Create the modpack folder if it does not exist
      if (!fs.existsSync(modpackFolder)) {
        fs.mkdirSync(modpackFolder);
      }

      // Download all the files in the manifest.json
      // Url: https://www.curseforge.com/api/v1/mods/<projectID>/files/<fileID>/download

      // Iterate over the files in the manifest.json and store them in the directory inside a "mods" folder

      // Set the progress to 0 and the total to the number of files in the manifest
      ipcMain.emit('set:download:progress', {
        isDownloading: true,
        current: 0,
        total: manifestData.files.length,
      } as IProgress);

      const total = manifestData.files.length;
      STORE.set('downloadProgressTotal', total);

      for (const file of manifestData.files) {
        const isCancel = STORE.get('cancelConversion') as boolean;
        if (isCancel) {
          ipcMain.emit('set:download:complete', false);
          STORE.set('isDownloading', false);
          STORE.set('cancelConversion', false);
          handleCleanup(modpackFolder);
          return;
        }
        const url = `https://www.curseforge.com/api/v1/mods/${file.projectID}/files/${file.fileID}/download`;
        const response = await fetch(url, {
          method: 'GET',
        });

        const fileSize = response.headers.get('content-length');

        file.size = parseInt(fileSize as string);

        const data = await response.arrayBuffer();

        const sha1 = crypto
          .createHash('sha1')
          .update(Buffer.from(data))
          .digest('hex');

        const sha512 = crypto
          .createHash('sha512')
          .update(Buffer.from(data))
          .digest('hex');

        file.hashes = {
          sha1: sha1,
          sha512: sha512,
        };

        const current =
          (STORE.get('downloadProgressCurrent') as number) + 1 || 0;
        STORE.set('downloadProgressCurrent', current);
        ipcMain.emit('set:download:progress', {
          isDownloading: true,
          current: current,
          total: total,
        } as IProgress);
      }

      // Check if the overrides folder exists else create it
      if (!fs.existsSync(path.join(modpackFolder, 'overrides'))) {
        fs.mkdirSync(path.join(modpackFolder, 'overrides'));
      }

      //   Extract the overrides folder from the zip file into the modpack/overrides folder
      zip.extract('overrides', path.join(modpackFolder, 'overrides'), (err) => {
        if (err) {
          console.log('Error extracting overrides folder');

          console.error(err);
        } else {
          console.log('Overrides folder extracted');
          zip.close();
        }
      });

      let deps: { [key: string]: string } = {};

      deps['minecraft'] = manifestData.minecraft.version;

      for (const loader of manifestData.minecraft.modLoaders) {
        const [loaderId, loaderVersion] = loader.id.split('-');
        deps[loaderId] = loaderVersion;
      }

      async function createMrPack(
        manifestData: IManifest,
        deps: { [key: string]: string }
      ): Promise<IMRPack> {
        const files = await Promise.all(
          manifestData.files.map(async (file) => ({
            path: `mods/${file.projectID}-${file.fileID}.jar`,
            hashes: {
              sha1: file.hashes.sha1,
              sha512: file.hashes.sha512,
            },
            downloads: [
              `https://www.curseforge.com/api/v1/mods/${file.projectID}/files/${file.fileID}/download`,
            ],
            fileSize: file.size,
          }))
        );

        const mrpack: IMRPack = {
          formatVersion: 1,
          game: 'minecraft',
          versionId: manifestData.version,
          name: manifestData.name,
          dependencies: deps,
          files,
        };

        return mrpack;
      }

      fs.writeFileSync(
        path.join(modpackFolder, 'modrinth.index.json'),
        JSON.stringify(await createMrPack(manifestData, deps), null, 2)
      );

      // Zip the modpack folder and save it as .mrpack file
      // Include directries and files in the modpack folder
      const output = fs.createWriteStream(`${modpackFolder}.mrpack`);
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });

      archive.pipe(output);
      archive.directory(modpackFolder, false);
      await archive.finalize();

      // Delete the modpack folder
      await deleteAsync(modpackFolder, {
        force: true,
      });

      // Reset the progress
      ipcMain.emit('set:download:progress', {
        isDownloading: false,
        current: 0,
        total: 0,
      } as IProgress);

      ipcMain.emit('set:download:complete', true);
      STORE.set('isDownloading', false);
    }
  });
};
