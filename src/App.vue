<script setup lang="ts">
import { IProgress } from 'types/interfaces';
import { ref } from 'vue';
const chosenZip = ref<string | null>(null);
const chosenDirectory = ref<string | null>(null);

const isDownloading = ref(false);

const currentProgress = ref<number>(0);
const maxProgress = ref<number>(0);
const showSuccess = ref(false);
const showError = ref(false);

window.ipcRenderer.onGetProgress((progress: IProgress) => {
  currentProgress.value = progress.current;
  maxProgress.value = progress.total;
  isDownloading.value = progress.current !== progress.total;
});

window.ipcRenderer.onComplete((val) => {
  isDownloading.value = false;
  currentProgress.value = 0;
  maxProgress.value = 0;

  if (val) {
    setTimeout(() => {
      showSuccess.value = true;
      setTimeout(() => {
        // Wait until the animation is done and then reset the value
        showSuccess.value = false;
      }, 5000);
    }, 1000);
  }
});

const handleZipFile = async (event: Event) => {
  const response = await window.ipcRenderer.selectFile();
  console.log(response);
  chosenZip.value = response;
};

const handleDirectory = async (event: Event) => {
  const dir = await window.ipcRenderer.selectFolder();
  console.log(dir);
  chosenDirectory.value = dir;
};

const beginConversion = async () => {
  isDownloading.value = true;
  await window.ipcRenderer.downloadModpack();
};

const cancelConversion = async () => {
  isDownloading.value = false;
  await window.ipcRenderer.cancelConversion().then(() => {
    setTimeout(() => {
      showError.value = true;
      setTimeout(() => {
        // Wait until the animation is done and then reset the value
        showError.value = false;
      }, 5000);
    }, 1000);
  });
};
</script>

<template>
  <div
    class="flex flex-col justify-center items-center w-full h-full gap-8 overflow-y-auto"
    :class="{
      'cursor-progress': isDownloading,
      'flash-success': showSuccess,
      'flash-danger': showError,
    }"
  >
    <h1 class="header font-bold text-center text-balance">
      Curseforge to <span class="text-green-500">Modrinth</span>
    </h1>
    <div v-if="!isDownloading" class="flex flex-col gap-4 p-4">
      <div class="input-group">
        <label for="zip">Select a curseforge modpack zip file</label>
        <p>
          {{ chosenZip ? chosenZip : 'No zip file selected' }}
        </p>
        <button
          id="zip"
          type="button"
          @click="handleZipFile"
          class="btn btn-primary"
          :disabled="isDownloading"
        >
          Select a zip file
        </button>
      </div>

      <div class="input-group">
        <label for="directory">Output directory</label>
        <p>
          {{ chosenDirectory ? chosenDirectory : 'No directory selected' }}
        </p>
        <button
          id="directory"
          type="button"
          @click="handleDirectory"
          class="btn btn-primary"
          :disabled="isDownloading"
        >
          Select a directory
        </button>
      </div>
      <button
        type="button"
        @click="beginConversion"
        :disabled="!chosenZip || !chosenDirectory || isDownloading"
        class="btn btn-primary"
      >
        Convert
      </button>
    </div>
    <div v-else-if="isDownloading" class="flex flex-col gap-4 items-center">
      <p>Converting modpack... {{ currentProgress }} / {{ maxProgress }}</p>
      <progress
        class="progress"
        :value="currentProgress"
        :max="maxProgress"
      ></progress>
      <button type="button" @click="cancelConversion" class="btn btn-danger">
        Cancel
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  font-size: clamp(1.5rem, 5vw, 3rem);
}

.input-group {
  @apply flex flex-col items-center justify-center gap-2 p-4 border border-green-500 rounded-md;

  label {
    @apply text-lg font-semibold;
  }
}

@keyframes flash-green {
  0% {
    @apply bg-neutral-800;
  }
  50% {
    @apply bg-green-800;
  }
  100% {
    @apply bg-neutral-800;
  }
}

@keyframes flash-red {
  0% {
    @apply bg-neutral-800;
  }
  50% {
    @apply bg-red-800;
  }
  100% {
    @apply bg-neutral-800;
  }
}

.flash-success {
  @apply transition-colors bg-green-800;
  animation: flash-green 800ms ease-in-out 4 forwards;
}

.flash-danger {
  @apply transition-colors bg-red-800;
  animation: flash-red 800ms ease-in-out 4 forwards;
}

// Style the inputs
.btn {
  @apply px-4 py-2 text-white rounded-md transition-colors duration-300 ease-out disabled:bg-neutral-500 disabled:cursor-not-allowed;
  &.btn-danger:not(:disabled) {
    @apply bg-red-500 hover:bg-red-600;
  }
  &.btn-primary:not(:disabled) {
    @apply bg-green-500 hover:bg-green-600;
  }
}

.progress[value] {
  &::-webkit-progress-value {
    background-image: -webkit-linear-gradient(
        -45deg,
        transparent 33%,
        rgba(0, 0, 0, 0.1) 33%,
        rgba(0, 0, 0, 0.1) 66%,
        transparent 66%
      ),
      -webkit-linear-gradient(top, rgba(255, 255, 255, 0.25), rgba(0, 0, 0, 0.25)),
      -webkit-linear-gradient(left, red, rgb(54, 204, 76));

    @apply rounded-md;
    background-size: 35px 20px, 100% 100%, 100% 100%;
  }

  &::-webkit-progress-bar {
    @apply bg-neutral-600 rounded-md;
  }
}
</style>
