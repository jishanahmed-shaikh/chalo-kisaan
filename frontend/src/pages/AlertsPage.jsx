/**
 * AlertsPage — Booking requests and alerts (Demo)
 * 
 * 🎯 DEMO PURPOSE ONLY — Full implementation is future scope
 * Displays sample alerts and booking notifications
 */
import React, { useState } from 'react';
import {
  IconArrowLeft, IconBell, IconCalendarEvent, IconMapPin,
  IconClock, IconUser, IconCheck, IconAlertCircle,
  IconTrash, IconArchive,
} from '@tabler/icons-react';
import { useLanguage } from '../context/LanguageContext';
import './AlertsPage.css';

const DEMO_ALERTS = [
  {
    id: 1,
    type: 'booking',
    title: 'New Booking Request',
    subtitle: 'Agritourism Experience',
    message: 'Ramesh Kumar requested a booking for 2 adults on March 15, 2026',
    time: '2 hours ago',
    icon: IconCalendarEvent,
    color: '#4caf50',
    status: 'pending',
  },
  {
    id: 2,
    type: 'confirmation',
    title: 'Booking Confirmed',
    subtitle: 'Farm Visit',
    message: 'Your farm visit booking is confirmed for Priya Sharma on March 12, 2026',
    time: '1 day ago',
    icon: IconCheck,
    color: '#2196f3',
    status: 'confirmed',
  },
  {
    id: 3,
    type: 'warning',
    title: 'Weather Alert',
    subtitle: 'Heavy Rain Expected',
    message: 'Heavy rainfall expected in your area on March 18. Consider postponing outdoor activities.',
    time: '3 hours ago',
    icon: IconAlertCircle,
    color: '#ff9800',
    status: 'alert',
  },
  {
    id: 4,
    type: 'booking',
    title: 'Booking Cancelled',
    subtitle: 'Farm Stay Package',
    message: 'Guest Arjun Patel cancelled the booking for March 20-22, 2026',
    time: '1 week ago',
    icon: IconTrash,
    color: '#f44336',
    status: 'cancelled',
  },
  {
    id: 5,
    type: 'info',
    title: 'Govt Scheme Notification',
    subtitle: 'PM Krishi Sinchayee Yojana',
    message: 'New subsidy available for drip irrigation systems. Apply by March 31, 2026.',
    time: '2 days ago',
    icon: IconBell,
    color: '#9c27b0',
    status: 'info',
  },
];

export default function AlertsPage({ onBack }) {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState(DEMO_ALERTS);
  const [filter, setFilter] = useState('all');

  const filteredAlerts = filter === 'all' ? alerts : alerts.filter(a => a.status === filter);

  const handleArchive = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  return (
    <div className="alerts">
      {/* ── Header ── */}
      <div className="alerts__header">
        <button className="alerts__back-btn" onClick={onBack} aria-label="Back">
          <IconArrowLeft size={20} strokeWidth={2} />
        </button>
        <h1 className="alerts__title">Alerts & Notifications</h1>
        <div style={{ width: 20 }} />
      </div>

      {/* ── Demo Banner ── */}
      <div className="alerts__demo-banner">
        <IconBell size={14} strokeWidth={2} />
        <span>
          <strong>Demo Mode:</strong> Showing sample alerts. Full implementation coming soon.
        </span>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="alerts__filters">
        {['all', 'pending', 'confirmed', 'alert', 'info'].map(status => (
          <button
            key={status}
            className={`alerts__filter-btn${filter === status ? ' alerts__filter-btn--active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Alerts List ── */}
      <div className="alerts__list">
        {filteredAlerts.length === 0 ? (
          <div className="alerts__empty">
            <IconBell size={48} strokeWidth={1} opacity={0.3} />
            <p>No alerts in this category</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const Icon = alert.icon;
            return (
              <div key={alert.id} className={`alerts__item alerts__item--${alert.status}`}>
                <div className="alerts__item-icon" style={{ color: alert.color }}>
                  <Icon size={22} strokeWidth={1.8} />
                </div>

                <div className="alerts__item-content">
                  <div className="alerts__item-header">
                    <h3 className="alerts__item-title">{alert.title}</h3>
                    <span className="alerts__item-time">{alert.time}</span>
                  </div>
                  <p className="alerts__item-subtitle">{alert.subtitle}</p>
                  <p className="alerts__item-message">{alert.message}</p>
                </div>

                <button
                  className="alerts__item-action"
                  onClick={() => handleArchive(alert.id)}
                  aria-label="Archive"
                  title="Archive this alert"
                >
                  <IconArchive size={18} strokeWidth={1.8} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Bottom Padding ── */}
      <div className="alerts__bottom-pad" />
    </div>
  );
}
