import { writable } from 'svelte/store'

export interface UploadedFile {
  id: string
  file: File
  title: string
}

interface UploadStore {
  files: UploadedFile[]
  createdAt: Date
  isUploading: boolean
  status: 'idle' | 'uploading' | 'error' | 'success'
  errorMessage: string | null
}

const createUploadStore = () => {
  const { subscribe, update, set } = writable<UploadStore>({
    files: [],
    createdAt: new Date(),
    isUploading: false,
    status: 'idle',
    errorMessage: null
  })

  const createId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  const getDefaultTitle = (fileName: string) => {
    const extIndex = fileName.lastIndexOf('.')
    if (extIndex <= 0) return fileName
    return fileName.slice(0, extIndex)
  }

  return {
    subscribe,

    addFiles: (files: FileList | File[]) => {
      const fileList = Array.from(files)
      if (fileList.length === 0) return

      update((store) => {
        const nextFiles = [
          ...store.files,
          ...fileList.map((file) => ({
            id: createId(),
            file,
            title: getDefaultTitle(file.name)
          }))
        ]

        return {
          ...store,
          files: nextFiles,
          createdAt: new Date(),
          status: nextFiles.length > 0 ? 'success' : 'idle',
          errorMessage: null
        }
      })
    },

    removeFile: (id: string) => {
      update((store) => ({
        ...store,
        files: store.files.filter((f) => f.id !== id),
        status:
          store.files.filter((f) => f.id !== id).length > 0
            ? 'success'
            : 'idle'
      }))
    },

    setFileTitle: (id: string, title: string) => {
      update((store) => ({
        ...store,
        files: store.files.map((file) =>
          file.id === id ? { ...file, title } : file
        )
      }))
    },

    clearError: () => {
      update((store) => ({
        ...store,
        status: store.files.length > 0 ? 'success' : 'idle',
        errorMessage: null
      }))
    },

    setUploading: () => {
      update((store) => ({
        ...store,
        isUploading: true,
        status: 'uploading',
        errorMessage: null
      }))
    },

    setUploadError: (message: string) => {
      update((store) => ({
        ...store,
        isUploading: false,
        status: 'error',
        errorMessage: message
      }))
    },

    setUploadSuccess: () => {
      update((store) => ({
        ...store,
        isUploading: false,
        status: store.files.length > 0 ? 'success' : 'idle',
        errorMessage: null
      }))
    },

    reset: () => {
      set({
        files: [],
        createdAt: new Date(),
        isUploading: false,
        status: 'idle',
        errorMessage: null
      })
    }
  }
}

export const documentUploadStore = createUploadStore()
