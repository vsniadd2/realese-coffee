import React, { useState, useEffect } from 'react'
import { clientService } from '../services/clientService'
import { useNotification } from './NotificationProvider'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import { useAuth } from '../contexts/AuthContext'
import ConfirmDialog from './ConfirmDialog'
import { normalizeMiddleNameForDisplay } from '../utils/clientDisplay'
import './ClientModal.css'
import './EditClientModal.css'

const EditClientModal = ({ client, onClose }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    clientId: '',
    status: 'standart'
  })
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { showNotification } = useNotification()
  const { refreshAll } = useDataRefresh()
  const { refreshAccessToken, user } = useAuth()
  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (client) {
      setFormData({
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        middleName: normalizeMiddleNameForDisplay(client.middle_name) || '',
        clientId: client.client_id || '',
        status: client.status || 'standart'
      })
    }
  }, [client])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !confirmDelete) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose, confirmDelete])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName,
      clientId: formData.clientId,
      status: formData.status
    }
    try {
      await clientService.update(client.id, payload)
      showNotification('Данные клиента сохранены', 'success')
      refreshAll()
      onClose()
    } catch (err) {
      if (err?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            await clientService.update(client.id, payload)
            showNotification('Данные клиента сохранены', 'success')
            refreshAll()
            onClose()
            return
          } catch (retryErr) {
            showNotification(retryErr.message || 'Ошибка сохранения', 'error')
          }
        } else {
          showNotification('Сессия истекла. Войдите снова.', 'error')
        }
      } else {
        showNotification(err.message || 'Ошибка сохранения', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = () => {
    setConfirmDelete(true)
  }

  const handleConfirmDelete = async () => {
    setLoading(true)
    try {
      await clientService.delete(client.id)
      showNotification('Клиент удалён', 'success')
      refreshAll()
      setConfirmDelete(false)
      onClose()
    } catch (err) {
      if (err?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            await clientService.delete(client.id)
            showNotification('Клиент удалён', 'success')
            refreshAll()
            setConfirmDelete(false)
            onClose()
            return
          } catch (retryErr) {
            showNotification(retryErr.message || 'Ошибка удаления', 'error')
          }
        } else {
          showNotification('Сессия истекла. Войдите снова.', 'error')
        }
      } else {
        showNotification(err.message || 'Ошибка удаления', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!client) return null

  return (
    <>
      <div className="edit-client-modal modal" role="dialog" aria-modal="true">
        <div className="modal-overlay" onClick={onClose} />
        <div className="modal-content edit-client-modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Редактирование клиента</h2>
            <button type="button" className="close-modal" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="input-group">
                <label>Имя</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="input-group">
                <label>Фамилия</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="input-group">
                <label>Отчество</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="input-group">
                <label>ID (телефон или строка)</label>
                <input
                  type="text"
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="input-group">
                <label>Статус</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  disabled={loading}
                  className="edit-client-status-select"
                >
                  <option value="standart">STANDART</option>
                  <option value="gold">GOLD</option>
                </select>
              </div>
            </div>
            <div className="edit-client-actions">
              <button type="submit" className="btn-submit" disabled={loading}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="btn-delete-client"
                  onClick={handleDeleteClick}
                  disabled={loading}
                >
                  Удалить клиента
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          isOpen={confirmDelete}
          title="Удалить клиента?"
          message="Все данные и история покупок этого клиента будут удалены. Это действие нельзя отменить."
          confirmText="Удалить"
          cancelText="Отмена"
          confirmType="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}

export default EditClientModal
