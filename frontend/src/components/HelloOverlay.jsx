import React, { useEffect, useState } from 'react'
import './HelloOverlay.css'

const HELLO_DURATION_MS = 3000

const HelloOverlay = ({ onEnd }) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      onEnd?.()
    }, HELLO_DURATION_MS)
    return () => clearTimeout(t)
  }, [onEnd])

  if (!visible) return null

  return (
    <div className="hello-overlay" aria-hidden="true">
      <span className="hello-text">Hello</span>
    </div>
  )
}

export default HelloOverlay
