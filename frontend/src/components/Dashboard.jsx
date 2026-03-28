import React, { useState } from 'react'
import Header from './Header'
import ClientList from './ClientList'
import ClientModal from './ClientModal'
import PurchaseModal from './PurchaseModal'
import './Dashboard.css'

const Dashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)

  return (
    <div className="main-screen">
      <Header
        onAddClient={() => setIsModalOpen(true)}
        onSelectClient={(client) => setSelectedClient(client)}
      />
      <main className="main-content">
        <ClientList onSelectClient={(client) => setSelectedClient(client)} />
      </main>
      {isModalOpen && (
        <ClientModal onClose={() => setIsModalOpen(false)} />
      )}
      {selectedClient && (
        <PurchaseModal client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}
    </div>
  )
}

export default Dashboard
