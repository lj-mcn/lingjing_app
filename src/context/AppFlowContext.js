import React, { createContext, useState, useContext } from 'react'

const AppFlowContext = createContext()

export const AppFlowProvider = ({ children }) => {
  const [videoWatched, setVideoWatched] = useState(false)
  const [musicSettingsCompleted, setMusicSettingsCompleted] = useState(false)
  const [musicEnabled, setMusicEnabled] = useState(true)

  const resetAppFlow = () => {
    setVideoWatched(false)
    setMusicSettingsCompleted(false)
    setMusicEnabled(true)
  }

  const markVideoWatched = () => {
    setVideoWatched(true)
  }

  const markMusicSettingsCompleted = (enableMusic = true) => {
    setMusicSettingsCompleted(true)
    setMusicEnabled(enableMusic)
  }

  return (
    <AppFlowContext.Provider value={{
      videoWatched,
      musicSettingsCompleted,
      musicEnabled,
      resetAppFlow,
      markVideoWatched,
      markMusicSettingsCompleted,
    }}
    >
      {children}
    </AppFlowContext.Provider>
  )
}

export const useAppFlow = () => {
  const context = useContext(AppFlowContext)
  if (!context) {
    throw new Error('useAppFlow must be used within an AppFlowProvider')
  }
  return context
}
