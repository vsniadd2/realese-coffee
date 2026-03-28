import React from 'react'
import './LoadingIndicator.css'

const LoadingIndicator = ({ size = 'medium', inline = false, text = '' }) => {
  return (
    <div className={`loading-indicator ${inline ? 'inline' : ''} ${size}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <span className="loading-text">{text}</span>}
    </div>
  )
}

export default LoadingIndicator
