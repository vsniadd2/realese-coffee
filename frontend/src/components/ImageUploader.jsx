import React, { useState, useRef } from 'react'
import './ImageUploader.css'

const ImageUploader = ({ onImageSelect, currentImage, maxSizeMB = 25, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      processFile(file)
    }
  }

  const handleFileSelect = (e) => {
    if (disabled) return
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    e.target.value = ''
  }

  const processFile = (file) => {
    setUploadError(null)

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setUploadError('Пожалуйста, выберите изображение')
      return
    }

    // Проверка размера файла
    const maxSize = maxSizeMB * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError(`Размер файла не должен превышать ${maxSizeMB} МБ`)
      return
    }

    // Передаем файл родительскому компоненту
    if (onImageSelect) {
      onImageSelect(file)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="image-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!currentImage ? (
        <div
          className={`image-uploader-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'image-uploader-disabled' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ pointerEvents: disabled ? 'none' : undefined, opacity: disabled ? 0.7 : 1 }}
        >
          <div className="image-uploader-content">
            {disabled && <p className="image-uploader-loading-text">Обработка изображения...</p>}
            <svg
              className="image-uploader-icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="image-uploader-text">
              Перетащите изображение сюда или
            </p>
            <button
              type="button"
              className="image-uploader-button"
              onClick={handleButtonClick}
            >
              Загрузить картинку
            </button>
            <p className="image-uploader-hint">
              PNG, JPG, GIF до {maxSizeMB} МБ
            </p>
          </div>
        </div>
      ) : (
        <div className="image-uploader-preview-container">
          <img
            src={currentImage}
            alt="Preview"
            className="image-uploader-preview"
          />
          <div className="image-uploader-preview-actions">
            <button
              type="button"
              className="image-uploader-change-btn"
              onClick={handleButtonClick}
            >
              Изменить
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="image-uploader-error">{uploadError}</div>
      )}
    </div>
  )
}

export default ImageUploader
