import React, { createContext, useState, useContext } from 'react'

const AppFlowContext = createContext()

export const AppFlowProvider = ({ children }) => {
  const [videoWatched, setVideoWatched] = useState(false)
  const [musicSettingsCompleted, setMusicSettingsCompleted] = useState(false)

  const resetAppFlow = () => {
    setVideoWatched(false)
    setMusicSettingsCompleted(false)
  }

  const markVideoWatched = () => {
    setVideoWatched(true)
  }

  const markMusicSettingsCompleted = () => {
    setMusicSettingsCompleted(true)
  }

  return (
    <AppFlowContext.Provider value={{
      videoWatched,
      musicSettingsCompleted,
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
