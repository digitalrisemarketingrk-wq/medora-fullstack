'use client';

import { useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, BedDouble, BookOpen, Building,
  Building2, Calendar, CalendarDays, Check, CheckCircle2, ChevronRight,
  Clock, Clock3, Copy, DollarSign, ExternalLink, FileCheck, FileCode, FileText,
  FolderKanban, Gauge, HeartPulse, Landmark, Layers, Mail, MapPin,
  MessageSquare, Package, Phone, Pill, Plus, Receipt, Search, Send,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Tag, ThumbsUp,
  Timer, User, UserCheck, Users, Video, Wallet, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import type { PracticeModule, PracticeRecord } from '@/lib/practice-api';
import './practice-domain-views.css';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'PT';
}

function stamp(value: string) {
  try {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

function dateOnly(value: string) {
  try {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

function money(amount: string, currency = 'INR') {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(Number(amount) || 0);
}

// ============================================================================
// 1. PATIENTS DIRECTORY WORKSPACE
// ============================================================================
export function PatientDirectoryView({
  records,
  onOpen,
  onCreate,
  onContinueCare
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
  onContinueCare: (record: PracticeRecord, module: string) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'active' | 'allergies'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const filtered = records.filter(r => {
    if (filter === 'active') return r.status === 'Active';
    if (filter === 'allergies') return Boolean(r.data.allergies?.trim());
    return true;
  });

  const withAllergiesCount = records.filter(r => Boolean(r.data.allergies?.trim())).length;
  const activeCount = records.filter(r => r.status === 'Active').length;

  return (
    <div className="pr-domain-workspace pr-patients-workspace">
      {/* Top Metric Strip */}
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Total Patients</span>
            <span className="pr-dm-icon blue"><Users size={18} /></span>
          </div>
          <strong>{records.length}</strong>
          <small>Registered in practice</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Active Patients</span>
            <span className="pr-dm-icon teal"><UserCheck size={18} /></span>
          </div>
          <strong>{activeCount}</strong>
          <small>Eligible for active care</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Recorded Allergies</span>
            <span className="pr-dm-icon amber"><ShieldAlert size={18} /></span>
          </div>
          <strong>{withAllergiesCount}</strong>
          <small>Safety reconciliation flagged</small>
        </div>
      </div>

      {/* Control bar */}
      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          <button className={`pr-tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            All ({records.length})
          </button>
          <button className={`pr-tab-btn ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>
            Active ({activeCount})
          </button>
          <button className={`pr-tab-btn ${filter === 'allergies' ? 'active' : ''}`} onClick={() => setFilter('allergies')}>
            With Allergies ({withAllergiesCount})
          </button>
        </div>
        <div className="pr-view-toggle">
          <button className={`pr-vt-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')}>
            Cards View
          </button>
          <button className={`pr-vt-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>
            Table View
          </button>
        </div>
      </div>

      {/* Card Grid View */}
      {viewMode === 'cards' ? (
        <div className="pr-patient-grid">
          {filtered.map(patient => {
            const hasAllergies = Boolean(patient.data.allergies?.trim());
            return (
              <div key={patient.id} className="pr-patient-card">
                <div className="pr-pc-top">
                  <div className="pr-pc-avatar">{initials(patient.title)}</div>
                  <div className="pr-pc-info">
                    <button className="pr-pc-name-link" onClick={() => onOpen(patient)}>
                      <h4>{patient.title}</h4>
                    </button>
                    <div className="pr-pc-meta">
                      {patient.data.dob && <span>DOB: {dateOnly(patient.data.dob)}</span>}
                      <span className={`pr-badge ${patient.status === 'Active' ? 'good' : 'muted'}`}>
                        {patient.status}
                      </span>
                    </div>
                  </div>
                </div>

                {hasAllergies && (
                  <div className="pr-pc-allergy-alert">
                    <ShieldAlert size={14} />
                    <span>Allergies: {patient.data.allergies}</span>
                  </div>
                )}

                <div className="pr-pc-contacts">
                  {patient.data.phone && (
                    <span className="pr-contact-pill">
                      <Phone size={12} /> {patient.data.phone}
                    </span>
                  )}
                  {patient.data.email && (
                    <span className="pr-contact-pill">
                      <Mail size={12} /> {patient.data.email}
                    </span>
                  )}
                </div>

                {patient.data.history && (
                  <p className="pr-pc-history">
                    <strong>History:</strong> {patient.data.history}
                  </p>
                )}

                {/* Quick Care Launcher Buttons */}
                <div className="pr-pc-actions">
                  <button
                    className="pr-pc-act-btn"
                    title="Book Appointment"
                    onClick={() => onContinueCare(patient, 'appointments')}
                  >
                    <Calendar size={13} /> Book
                  </button>
                  <button
                    className="pr-pc-act-btn primary"
                    title="Start Clinical Encounter"
                    onClick={() => onContinueCare(patient, 'emr')}
                  >
                    <Stethoscope size={13} /> Encounter
                  </button>
                  <button
                    className="pr-pc-act-btn"
                    title="Issue Prescription"
                    onClick={() => onContinueCare(patient, 'prescriptions')}
                  >
                    <Pill size={13} /> Rx
                  </button>
                  <button
                    className="pr-pc-act-btn"
                    title="Create Invoice"
                    onClick={() => onContinueCare(patient, 'billing')}
                  >
                    <Wallet size={13} /> Bill
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Enhanced Table View */
        <div className="pr-domain-table-wrap">
          <table className="pr-domain-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Contact</th>
                <th>DOB / Age</th>
                <th>Safety Alerts</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(patient => (
                <tr key={patient.id} onClick={() => onOpen(patient)}>
                  <td>
                    <div className="pr-tbl-patient">
                      <span className="pr-record-avatar">{initials(patient.title)}</span>
                      <div>
                        <strong>{patient.title}</strong>
                        <small>ID: {patient.id.slice(0, 8)}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{patient.data.phone || '—'}</div>
                    <small>{patient.data.email || 'No email'}</small>
                  </td>
                  <td>{patient.data.dob ? dateOnly(patient.data.dob) : 'Not recorded'}</td>
                  <td>
                    {patient.data.allergies ? (
                      <span className="pr-safety-tag warning">
                        <ShieldAlert size={12} /> {patient.data.allergies.slice(0, 30)}
                      </span>
                    ) : (
                      <span className="pr-safety-tag safe">
                        <Check size={12} /> No allergies recorded
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`pr-badge ${patient.status === 'Active' ? 'good' : 'muted'}`}>
                      {patient.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="pr-button-sm primary"
                      onClick={e => {
                        e.stopPropagation();
                        onContinueCare(patient, 'emr');
                      }}
                    >
                      Encounter <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. APPOINTMENTS SCHEDULE BOARD
// ============================================================================
export function AppointmentScheduleView({
  records,
  patientNames,
  onOpen,
  onCreate,
  onContinueCare
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
  onContinueCare: (record: PracticeRecord, module: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = records.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const bookedCount = records.filter(r => r.status === 'Booked').length;
  const checkedInCount = records.filter(r => r.status === 'Checked in').length;
  const completedCount = records.filter(r => r.status === 'Completed').length;

  return (
    <div className="pr-domain-workspace pr-appointments-workspace">
      {/* Top Metric Strip */}
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Scheduled Bookings</span>
            <span className="pr-dm-icon blue"><CalendarDays size={18} /></span>
          </div>
          <strong>{bookedCount}</strong>
          <small>Upcoming patient arrivals</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Checked In / Waiting</span>
            <span className="pr-dm-icon amber"><Clock size={18} /></span>
          </div>
          <strong>{checkedInCount}</strong>
          <small>Patients ready in waiting bay</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Completed Today</span>
            <span className="pr-dm-icon teal"><CheckCircle2 size={18} /></span>
          </div>
          <strong>{completedCount}</strong>
          <small>Finished consultations</small>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {['all', 'Booked', 'Checked in', 'In consultation', 'Completed', 'Cancelled'].map(st => (
            <button
              key={st}
              className={`pr-tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? `All Visits (${records.length})` : st}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda Timeline List */}
      <div className="pr-schedule-timeline">
        {filtered.map(appt => {
          const patientName = patientNames[appt.data.patient_id] || 'Patient ' + appt.data.patient_id?.slice(0, 8);
          const isPending = ['Booked', 'Checked in'].includes(appt.status);
          return (
            <div key={appt.id} className={`pr-schedule-card ${appt.status.toLowerCase().replace(' ', '-')}`}>
              <div className="pr-sc-time">
                <Clock size={16} />
                <strong>{appt.data.starts_at ? stamp(appt.data.starts_at) : 'Time unset'}</strong>
                <span className="pr-sc-mode">{appt.data.mode || 'In person'}</span>
              </div>

              <div className="pr-sc-body">
                <div className="pr-sc-title-row">
                  <h4>{patientName}</h4>
                  <span className={`pr-badge ${appt.status === 'Completed' ? 'good' : isPending ? 'pending' : 'muted'}`}>
                    {appt.status}
                  </span>
                </div>
                <p className="pr-sc-reason">
                  <strong>Reason:</strong> {appt.data.reason || appt.title}
                </p>
                <div className="pr-sc-clinician">
                  <Stethoscope size={13} />
                  <span>Clinician: {appt.data.clinician || 'Unassigned'}</span>
                </div>
              </div>

              <div className="pr-sc-actions">
                <button className="pr-button-sm" onClick={() => onOpen(appt)}>
                  View Details
                </button>
                {isPending && (
                  <button
                    className="pr-button-sm primary"
                    onClick={() => onContinueCare(appt, 'emr')}
                  >
                    <Stethoscope size={13} /> Start Encounter
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="pr-empty compact">
            <Calendar size={28} />
            <h3>No visits found for this filter</h3>
            <p>Schedule a new booking or clear status filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. DIAGNOSTICS & LABORATORY WORKBENCH
// ============================================================================
export function LabKanbanView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const columns = [
    { key: 'Ordered', title: 'Ordered & Pending', tone: 'amber', icon: Clock },
    { key: 'Collected', title: 'Specimen Collected', tone: 'blue', icon: Activity },
    { key: 'Resulted', title: 'Results Entered', tone: 'violet', icon: FileText },
    { key: 'Reviewed', title: 'Reviewed & Signed', tone: 'teal', icon: CheckCircle2 }
  ];

  return (
    <div className="pr-domain-workspace pr-lab-workspace">
      {/* Pipeline Board */}
      <div className="pr-kanban-board">
        {columns.map(col => {
          const colItems = records.filter(r => r.status === col.key);
          const ColIcon = col.icon;
          return (
            <div key={col.key} className={`pr-kanban-col ${col.tone}`}>
              <div className="pr-col-header">
                <div className="pr-col-title">
                  <ColIcon size={16} />
                  <h3>{col.title}</h3>
                </div>
                <span className="pr-col-count">{colItems.length}</span>
              </div>

              <div className="pr-col-cards">
                {colItems.map(lab => {
                  const patientName = patientNames[lab.data.patient_id] || 'Patient ' + lab.data.patient_id?.slice(0, 6);
                  return (
                    <div key={lab.id} className="pr-kanban-card" onClick={() => onOpen(lab)}>
                      <div className="pr-kc-top">
                        <span className="pr-specimen-badge">
                          {lab.data.specimen || 'Specimen Pending'}
                        </span>
                        <small>{stamp(lab.updated_at)}</small>
                      </div>
                      <h4>{lab.title}</h4>
                      <div className="pr-kc-patient">
                        <User size={13} />
                        <span>{patientName}</span>
                      </div>
                      <div className="pr-kc-clinician">
                        <Stethoscope size={13} />
                        <small>Req: {lab.data.requested_by || 'Staff'}</small>
                      </div>
                      {lab.data.results && (
                        <div className="pr-kc-result-preview">
                          <strong>Results:</strong> {lab.data.results.slice(0, 60)}...
                        </div>
                      )}
                    </div>
                  );
                })}
                {colItems.length === 0 && (
                  <div className="pr-kanban-empty">No orders in this stage</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 4. INPATIENT WARD & BED BOARD (IPD)
// ============================================================================
export function IpdBedBoardView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const wards = ['All Wards', 'General Ward', 'ICU', 'Semi-Private', 'Deluxe Room', 'Emergency'];
  const [selectedWard, setSelectedWard] = useState('All Wards');

  const filtered = records.filter(r => {
    if (selectedWard === 'All Wards') return true;
    return r.data.ward === selectedWard;
  });

  const admittedCount = records.filter(r => r.status === 'Admitted').length;
  const dischargedCount = records.filter(r => r.status === 'Discharged').length;

  return (
    <div className="pr-domain-workspace pr-ipd-workspace">
      {/* Top Metric Strip */}
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Currently Admitted</span>
            <span className="pr-dm-icon amber"><BedDouble size={18} /></span>
          </div>
          <strong>{admittedCount}</strong>
          <small>Occupied inpatient beds</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Discharged Patients</span>
            <span className="pr-dm-icon teal"><CheckCircle2 size={18} /></span>
          </div>
          <strong>{dischargedCount}</strong>
          <small>Completed admissions</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Active Wards</span>
            <span className="pr-dm-icon blue"><Activity size={18} /></span>
          </div>
          <strong>{new Set(records.map(r => r.data.ward).filter(Boolean)).size || 1}</strong>
          <small>Configured care units</small>
        </div>
      </div>

      {/* Ward Filter Bar */}
      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {wards.map(ward => (
            <button
              key={ward}
              className={`pr-tab-btn ${selectedWard === ward ? 'active' : ''}`}
              onClick={() => setSelectedWard(ward)}
            >
              {ward}
            </button>
          ))}
        </div>
      </div>

      {/* Bed Bay Grid */}
      <div className="pr-bed-bays">
        {filtered.map(adm => {
          const patientName = patientNames[adm.data.patient_id] || 'Patient ' + adm.data.patient_id?.slice(0, 6);
          const isAdmitted = adm.status === 'Admitted';
          return (
            <div key={adm.id} className={`pr-bed-card ${isAdmitted ? 'occupied' : 'discharged'}`} onClick={() => onOpen(adm)}>
              <div className="pr-bed-header">
                <div className="pr-bed-number">
                  <BedDouble size={20} />
                  <span>{adm.data.bed || 'Bed —'}</span>
                </div>
                <span className={`pr-badge ${isAdmitted ? 'pending' : 'good'}`}>
                  {isAdmitted ? 'Occupied' : 'Discharged'}
                </span>
              </div>
              <div className="pr-bed-ward-pill">{adm.data.ward || 'General'}</div>
              <h4 className="pr-bed-patient">{patientName}</h4>
              <p className="pr-bed-reason">
                <strong>Admission:</strong> {adm.title}
              </p>
              {adm.data.admitted_at && (
                <div className="pr-bed-admit-time">
                  <Clock size={12} /> Admitted: {stamp(adm.data.admitted_at)}
                </div>
              )}
              {adm.data.nursing_notes && (
                <p className="pr-bed-nursing-snippet">
                  {adm.data.nursing_notes.slice(0, 50)}...
                </p>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="pr-empty compact">
            <BedDouble size={28} />
            <h3>No bed records in {selectedWard}</h3>
            <p>Admit a patient or select a different ward.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 5. PHARMACY & DISPENSING COUNTER
// ============================================================================
export function PharmacyDeckView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const lowStockCount = records.filter(r => Number(r.data.quantity || 0) <= Number(r.data.reorder || 10)).length;
  const availableCount = records.filter(r => r.status === 'Available').length;

  return (
    <div className="pr-domain-workspace pr-pharmacy-workspace">
      {/* Stock Health Strip */}
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Available Medicines</span>
            <span className="pr-dm-icon teal"><Pill size={18} /></span>
          </div>
          <strong>{availableCount}</strong>
          <small>Active batches in dispensary</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Low Stock Batches</span>
            <span className="pr-dm-icon amber"><AlertTriangle size={18} /></span>
          </div>
          <strong>{lowStockCount}</strong>
          <small>At or below reorder threshold</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Total Stock Items</span>
            <span className="pr-dm-icon blue"><Package size={18} /></span>
          </div>
          <strong>{records.length}</strong>
          <small>Tracked catalog formulations</small>
        </div>
      </div>

      {/* Stock Cards Grid */}
      <div className="pr-pharmacy-grid">
        {records.map(med => {
          const qty = Number(med.data.quantity || 0);
          const reorder = Number(med.data.reorder || 10);
          const isLow = qty <= reorder;
          return (
            <div key={med.id} className="pr-pharmacy-card" onClick={() => onOpen(med)}>
              <div className="pr-ph-top">
                <span className="pr-ph-icon"><Pill size={18} /></span>
                <span className={`pr-badge ${med.status === 'Available' ? 'good' : 'muted'}`}>
                  {med.status}
                </span>
              </div>
              <h4>{med.title}</h4>
              <div className="pr-ph-batch">
                <small>Batch #{med.data.batch || '—'}</small>
                {med.data.expiry && <small className="pr-ph-expiry">Exp: {med.data.expiry}</small>}
              </div>

              {/* Quantity Meter */}
              <div className="pr-ph-qty-block">
                <div className="pr-ph-qty-row">
                  <span>Stock Available:</span>
                  <strong>{qty} {med.data.unit || 'Units'}</strong>
                </div>
                <div className="pr-ph-meter">
                  <div
                    className={`pr-ph-fill ${isLow ? 'low' : 'good'}`}
                    style={{ width: `${Math.min(100, Math.max(10, (qty / (reorder * 3)) * 100))}%` }}
                  />
                </div>
                <small className={isLow ? 'pr-alert-text' : 'pr-good-text'}>
                  {isLow ? `Low stock alert (Threshold: ${reorder})` : `Healthy stock level`}
                </small>
              </div>

              <div className="pr-ph-footer">
                <small>Supplier: {med.data.supplier || 'Standard Direct'}</small>
                <button className="pr-button-sm primary" onClick={e => { e.stopPropagation(); onOpen(med); }}>
                  Dispense
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 6. TELEMEDICINE VIRTUAL CARE DECK
// ============================================================================
export function TelemedicineDeckView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const handleCopyLink = (url: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Patient WebRTC room link copied to clipboard');
    }).catch(() => {
      toast.info(`Room: ${url}`);
    });
  };

  return (
    <div className="pr-domain-workspace pr-telemedicine-workspace">
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Video Consultations</span>
            <span className="pr-dm-icon violet"><Video size={18} /></span>
          </div>
          <strong>{records.length}</strong>
          <small>Scheduled virtual visits</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>WebRTC Room Engine</span>
            <span className="pr-dm-icon teal"><ShieldCheck size={18} /></span>
          </div>
          <strong>Jitsi WebRTC</strong>
          <small>Free open-source P2P encrypted stream</small>
        </div>
        <div className="pr-domain-metric-card action">
          <div className="pr-dm-header">
            <span>Instant Virtual Visit</span>
            <span className="pr-dm-icon emerald"><Sparkles size={18} /></span>
          </div>
          <button
            type="button"
            className="pr-button primary pr-dm-action-btn"
            onClick={onCreate}
          >
            <Plus size={14} /> Start Consultation
          </button>
          <small>Open WebRTC room & worksheet</small>
        </div>
      </div>

      <div className="pr-telemedicine-grid">
        {records.map(tele => {
          const patientName = patientNames[tele.data.patient_id] || 'Patient ' + tele.data.patient_id?.slice(0, 6);
          const hasMeetingUrl = Boolean(tele.data.meeting_url?.trim());
          return (
            <div key={tele.id} className="pr-tele-card">
              <div className="pr-tc-header">
                <div className="pr-tc-icon"><Video size={18} /></div>
                <span className={`pr-badge ${tele.status === 'Scheduled' ? 'pending' : 'good'}`}>
                  {tele.status}
                </span>
              </div>
              <h4>{patientName}</h4>
              <p className="pr-tc-reason">
                <strong>Reason:</strong> {tele.title}
              </p>
              <div className="pr-tc-meta">
                <div className="pr-tc-row">
                  <Clock size={13} /> <span>{tele.data.starts_at ? stamp(tele.data.starts_at) : 'Time unset'}</span>
                </div>
                <div className="pr-tc-row">
                  <Stethoscope size={13} /> <span>Clinician: {tele.data.clinician || 'Unassigned'}</span>
                </div>
              </div>

              <div className="pr-tc-actions">
                <button
                  type="button"
                  className="pr-button primary"
                  onClick={() => onOpen(tele)}
                >
                  <Video size={14} /> Launch Consultation
                </button>
                {hasMeetingUrl && (
                  <button
                    type="button"
                    className="pr-button-sm"
                    onClick={() => handleCopyLink(tele.data.meeting_url)}
                    title="Copy Patient Meeting Link"
                  >
                    <Copy size={13} /> Copy Link
                  </button>
                )}
                <button
                  type="button"
                  className="pr-button-sm"
                  onClick={() => onOpen(tele)}
                >
                  Notes
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 7. COMMUNICATIONS & OUTREACH HUB
// ============================================================================
export function CommunicationsDeckView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  return (
    <div className="pr-domain-workspace pr-comms-workspace">
      <div className="pr-comms-grid">
        {records.map(msg => {
          const patientName = patientNames[msg.data.patient_id] || 'Recipient ' + msg.data.patient_id?.slice(0, 6);
          const channel = msg.data.channel || 'SMS';
          return (
            <div key={msg.id} className="pr-comm-card" onClick={() => onOpen(msg)}>
              <div className="pr-cc-header">
                <span className={`pr-channel-pill ${channel.toLowerCase()}`}>
                  {channel === 'WhatsApp' ? <MessageSquare size={13} /> : channel === 'Email' ? <Mail size={13} /> : <Phone size={13} />}
                  {channel}
                </span>
                <span className={`pr-badge ${msg.status === 'Ready' ? 'good' : 'pending'}`}>
                  {msg.status}
                </span>
              </div>
              <h4>{msg.title}</h4>
              <small className="pr-cc-recipient">To: {patientName}</small>

              {/* Message Bubble Preview */}
              <div className="pr-cc-bubble">
                <p>{msg.data.message || 'No message content composed.'}</p>
              </div>

              <div className="pr-cc-footer">
                <Clock size={12} />
                <small>{msg.data.scheduled_at ? stamp(msg.data.scheduled_at) : 'Drafted'}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 8. CLAIMS & INSURANCE RCM LEDGER
// ============================================================================
export function ClaimsLedgerView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const filtered = records.filter(r => statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase());
  const submittedCount = records.filter(r => r.status === 'Submitted').length;
  const approvedCount = records.filter(r => r.status === 'Approved').length;
  const totalValue = records.reduce((sum, r) => sum + (Number(r.data.amount) || 0), 0);

  return (
    <div className="pr-domain-workspace pr-claims-workspace">
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Total Claim Value</span>
            <span className="pr-dm-icon amber"><Wallet size={18} /></span>
          </div>
          <strong>{money(String(totalValue), records[0]?.data.currency || 'INR')}</strong>
          <small>{records.length} tracked claims</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Submitted & In Review</span>
            <span className="pr-dm-icon blue"><Clock size={18} /></span>
          </div>
          <strong>{submittedCount}</strong>
          <small>Awaiting payer adjudication</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Approved / Remitted</span>
            <span className="pr-dm-icon teal"><CheckCircle2 size={18} /></span>
          </div>
          <strong>{approvedCount}</strong>
          <small>Reimbursed claims</small>
        </div>
      </div>

      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {['all', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Reconciled'].map(st => (
            <button
              key={st}
              className={`pr-tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? `All Claims (${records.length})` : st}
            </button>
          ))}
        </div>
      </div>

      <div className="pr-claims-grid">
        {filtered.map(claim => {
          const patientName = patientNames[claim.data.patient_id] || 'Patient ' + claim.data.patient_id?.slice(0, 6);
          return (
            <div key={claim.id} className="pr-claim-card" onClick={() => onOpen(claim)}>
              <div className="pr-cl-top">
                <span className="pr-payer-pill"><Landmark size={13} /> {claim.data.payer || 'Direct Insurer'}</span>
                <span className={`pr-badge ${claim.status === 'Approved' ? 'good' : claim.status === 'Rejected' ? 'muted' : 'pending'}`}>
                  {claim.status}
                </span>
              </div>
              <h4>{claim.title}</h4>
              <div className="pr-cl-amount">
                <span>Claimed:</span>
                <strong>{money(claim.data.amount, claim.data.currency)}</strong>
              </div>
              <div className="pr-cl-patient">
                <User size={13} />
                <span>{patientName}</span>
                {claim.data.policy && <small>Policy: {claim.data.policy}</small>}
              </div>
              {claim.data.coding && (
                <div className="pr-cl-coding">
                  <Tag size={12} />
                  <span>Codes: {claim.data.coding.slice(0, 40)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 9. INVENTORY & CENTRAL SUPPLY TRACKER
// ============================================================================
export function InventoryTrackerView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const filtered = records.filter(r => categoryFilter === 'all' || r.data.category?.toLowerCase() === categoryFilter.toLowerCase());
  const lowStockCount = records.filter(r => Number(r.data.quantity || 0) <= Number(r.data.reorder || 10)).length;

  return (
    <div className="pr-domain-workspace pr-inventory-workspace">
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Total Catalog SKUs</span>
            <span className="pr-dm-icon blue"><Package size={18} /></span>
          </div>
          <strong>{records.length}</strong>
          <small>Supplies & equipment catalog</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Low Stock Alerts</span>
            <span className="pr-dm-icon amber"><AlertTriangle size={18} /></span>
          </div>
          <strong>{lowStockCount}</strong>
          <small>Items needing reordering</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Active Categories</span>
            <span className="pr-dm-icon teal"><Layers size={18} /></span>
          </div>
          <strong>{new Set(records.map(r => r.data.category).filter(Boolean)).size || 3}</strong>
          <small>Consumables, Equipment, Meds</small>
        </div>
      </div>

      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {['all', 'Consumable', 'Equipment', 'Medication'].map(cat => (
            <button
              key={cat}
              className={`pr-tab-btn ${categoryFilter.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? `All Items (${records.length})` : cat}
            </button>
          ))}
        </div>
      </div>

      <div className="pr-inventory-grid">
        {filtered.map(item => {
          const qty = Number(item.data.quantity || 0);
          const reorder = Number(item.data.reorder || 10);
          const isLow = qty <= reorder;
          return (
            <div key={item.id} className="pr-inventory-card" onClick={() => onOpen(item)}>
              <div className="pr-inv-top">
                <span className="pr-inv-cat"><Tag size={12} /> {item.data.category || 'Supply'}</span>
                <span className="pr-sku-tag">SKU: {item.data.sku || '—'}</span>
              </div>
              <h4>{item.title}</h4>
              <div className="pr-inv-qty-block">
                <div className="pr-inv-qty-row">
                  <span>In Stock:</span>
                  <strong>{qty} {item.data.unit || 'Units'}</strong>
                </div>
                <div className="pr-ph-meter">
                  <div
                    className={`pr-ph-fill ${isLow ? 'low' : 'good'}`}
                    style={{ width: `${Math.min(100, Math.max(8, (qty / (reorder * 2.5)) * 100))}%` }}
                  />
                </div>
                <small className={isLow ? 'pr-alert-text' : 'pr-good-text'}>
                  {isLow ? `Low stock (Threshold: ${reorder})` : `Sufficient stock`}
                </small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 10. HR & STAFF DUTY ROSTER
// ============================================================================
export function HrStaffRosterView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState('all');
  const filtered = records.filter(r => typeFilter === 'all' || r.data.type?.toLowerCase() === typeFilter.toLowerCase());
  const attendanceCount = records.filter(r => r.data.type === 'Attendance').length;
  const leaveCount = records.filter(r => r.data.type === 'Leave').length;

  return (
    <div className="pr-domain-workspace pr-hr-workspace">
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Staff Attendance Shifts</span>
            <span className="pr-dm-icon teal"><Clock3 size={18} /></span>
          </div>
          <strong>{attendanceCount}</strong>
          <small>Recorded working shifts</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Leave Requests</span>
            <span className="pr-dm-icon amber"><Calendar size={18} /></span>
          </div>
          <strong>{leaveCount}</strong>
          <small>Planned absence records</small>
        </div>
      </div>

      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {['all', 'Attendance', 'Leave'].map(t => (
            <button
              key={t}
              className={`pr-tab-btn ${typeFilter.toLowerCase() === t.toLowerCase() ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t === 'all' ? `All Shifts & Leaves (${records.length})` : t}
            </button>
          ))}
        </div>
      </div>

      <div className="pr-hr-grid">
        {filtered.map(hr => (
          <div key={hr.id} className="pr-hr-card" onClick={() => onOpen(hr)}>
            <div className="pr-hr-top">
              <span className={`pr-hr-type-pill ${hr.data.type?.toLowerCase() || 'attendance'}`}>
                {hr.data.type || 'Attendance'}
              </span>
              <span className={`pr-badge ${hr.status === 'Approved' ? 'good' : hr.status === 'Declined' ? 'muted' : 'pending'}`}>
                {hr.status}
              </span>
            </div>
            <h4>{hr.title}</h4>
            <div className="pr-hr-time-range">
              <Clock size={13} />
              <span>{hr.data.starts_at ? stamp(hr.data.starts_at) : 'Starts —'} → {hr.data.ends_at ? stamp(hr.data.ends_at) : 'Ends —'}</span>
            </div>
            {hr.data.notes && (
              <p className="pr-hr-notes">{hr.data.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 11. PATIENT CRM & ENGAGEMENT HUB
// ============================================================================
export function CrmEngagementView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  const [stageFilter, setStageFilter] = useState('all');
  const filtered = records.filter(r => stageFilter === 'all' || r.status.toLowerCase() === stageFilter.toLowerCase());
  const newLeads = records.filter(r => r.status === 'New').length;
  const convertedCount = records.filter(r => r.status === 'Converted').length;

  return (
    <div className="pr-domain-workspace pr-crm-workspace">
      <div className="pr-domain-metrics">
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>New Enquiries</span>
            <span className="pr-dm-icon amber"><Sparkles size={18} /></span>
          </div>
          <strong>{newLeads}</strong>
          <small>Awaiting initial outreach</small>
        </div>
        <div className="pr-domain-metric-card">
          <div className="pr-dm-header">
            <span>Converted Patients</span>
            <span className="pr-dm-icon teal"><UserCheck size={18} /></span>
          </div>
          <strong>{convertedCount}</strong>
          <small>Enrolled in active care</small>
        </div>
      </div>

      <div className="pr-domain-subbar">
        <div className="pr-filter-tabs">
          {['all', 'New', 'Contacted', 'Converted', 'Closed'].map(st => (
            <button
              key={st}
              className={`pr-tab-btn ${stageFilter.toLowerCase() === st.toLowerCase() ? 'active' : ''}`}
              onClick={() => setStageFilter(st)}
            >
              {st === 'all' ? `All Enquiries (${records.length})` : st}
            </button>
          ))}
        </div>
      </div>

      <div className="pr-crm-grid">
        {filtered.map(lead => {
          const consent = lead.data.marketing_consent || 'Not granted';
          const isGranted = consent === 'Granted';
          return (
            <div key={lead.id} className="pr-crm-card" onClick={() => onOpen(lead)}>
              <div className="pr-crm-top">
                <span className={`pr-badge ${lead.status === 'Converted' ? 'good' : lead.status === 'Contacted' ? 'pending' : 'muted'}`}>
                  {lead.status}
                </span>
                <span className={`pr-consent-pill ${isGranted ? 'granted' : 'pending'}`}>
                  {isGranted ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                  Consent: {consent}
                </span>
              </div>
              <h4>{lead.title}</h4>
              <div className="pr-crm-contact">
                <Phone size={13} />
                <span>{lead.data.contact || 'No contact details'}</span>
              </div>
              {lead.data.follow_up && (
                <div className="pr-crm-followup">
                  <Calendar size={13} />
                  <small>Follow-up: {dateOnly(lead.data.follow_up)}</small>
                </div>
              )}
              {lead.data.source && (
                <span className="pr-crm-source">Source: {lead.data.source}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 12. MEDICO-LEGAL CONSENT & FEEDBACK VAULT
// ============================================================================
export function ConsentVaultView({
  records,
  patientNames,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  return (
    <div className="pr-domain-workspace pr-consent-workspace">
      <div className="pr-consent-grid">
        {records.map(con => {
          const patientName = patientNames[con.data.patient_id] || 'Patient ' + con.data.patient_id?.slice(0, 6);
          return (
            <div key={con.id} className="pr-consent-card" onClick={() => onOpen(con)}>
              <div className="pr-con-top">
                <span className="pr-con-type"><Shield size={13} /> {con.data.type || 'Consent'}</span>
                <span className={`pr-badge ${con.status === 'Recorded' ? 'good' : 'muted'}`}>
                  {con.status}
                </span>
              </div>
              <h4>{con.title}</h4>
              <div className="pr-con-patient">
                <User size={13} />
                <span>{patientName}</span>
              </div>
              <div className="pr-con-witness">
                <small>Recorded by: {con.data.recorded_by || 'Staff'}</small>
                {con.data.date && <small>Date: {dateOnly(con.data.date)}</small>}
              </div>
              {con.data.evidence && (
                <p className="pr-con-evidence">{con.data.evidence.slice(0, 70)}...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 13. CLINICAL FORMS & TEMPLATES LIBRARY
// ============================================================================
export function TemplatesLibraryView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  return (
    <div className="pr-domain-workspace pr-templates-workspace">
      <div className="pr-templates-grid">
        {records.map(tmpl => (
          <div key={tmpl.id} className="pr-tmpl-card" onClick={() => onOpen(tmpl)}>
            <div className="pr-tmpl-top">
              <span className="pr-tmpl-specialty">{tmpl.data.specialty || 'General'}</span>
              <span className={`pr-badge ${tmpl.status === 'Published' ? 'good' : 'muted'}`}>
                {tmpl.status}
              </span>
            </div>
            <h4>{tmpl.title}</h4>
            <span className="pr-tmpl-type"><FileText size={12} /> {tmpl.data.type || 'Template'}</span>
            {tmpl.data.content && (
              <div className="pr-tmpl-preview">
                <p>{tmpl.data.content.slice(0, 80)}...</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 14. CLINIC FACILITIES & BRANCH LOCATIONS
// ============================================================================
export function BranchLocationsView({
  records,
  onOpen,
  onCreate
}: {
  records: PracticeRecord[];
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
}) {
  return (
    <div className="pr-domain-workspace pr-locations-workspace">
      <div className="pr-locations-grid">
        {records.map(loc => (
          <div key={loc.id} className="pr-loc-card" onClick={() => onOpen(loc)}>
            <div className="pr-loc-top">
              <div className="pr-loc-icon"><Building2 size={18} /></div>
              <span className={`pr-badge ${loc.status === 'Active' ? 'good' : 'muted'}`}>
                {loc.status}
              </span>
            </div>
            <h4>{loc.title}</h4>
            <div className="pr-loc-tz">
              <Clock size={13} />
              <span>Timezone: {loc.data.timezone || 'UTC'}</span>
            </div>
            {loc.data.address && (
              <div className="pr-loc-address">
                <MapPin size={13} />
                <span>{loc.data.address}</span>
              </div>
            )}
            {loc.data.phone && (
              <div className="pr-loc-phone">
                <Phone size={13} />
                <span>{loc.data.phone}</span>
              </div>
            )}
            {loc.data.hours && (
              <p className="pr-loc-hours"><strong>Hours:</strong> {loc.data.hours}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 15. TREATMENT & CARE PLANS
// ============================================================================
export function TreatmentsDeckView({
  records,
  patientNames,
  onOpen,
  onCreate,
  onContinueCare
}: {
  records: PracticeRecord[];
  patientNames: Record<string, string>;
  onOpen: (record: PracticeRecord) => void;
  onCreate: () => void;
  onContinueCare?: (record: PracticeRecord, module: string) => void;
}) {
  return (
    <div className="pr-domain-workspace pr-treatments-workspace">
      <div className="pr-treatments-grid">
        {records.map(tr => {
          const patientName = patientNames[tr.data.patient_id] || 'Patient ' + tr.data.patient_id?.slice(0, 6);
          return (
            <div key={tr.id} className="pr-treatment-card" onClick={() => onOpen(tr)}>
              <div className="pr-tr-top">
                <span className="pr-tr-icon"><HeartPulse size={18} /></span>
                <span className={`pr-badge ${tr.status === 'Active' ? 'good' : tr.status === 'Planned' ? 'pending' : 'muted'}`}>
                  {tr.status}
                </span>
              </div>
              <h4>{tr.title}</h4>
              <div className="pr-tr-patient">
                <User size={13} />
                <span>{patientName}</span>
              </div>
              {tr.data.goals && (
                <div className="pr-tr-goals">
                  <strong>Clinical Goals:</strong>
                  <p>{tr.data.goals}</p>
                </div>
              )}
              {tr.data.review_date && (
                <div className="pr-tr-review">
                  <Calendar size={12} />
                  <small>Next Review: {dateOnly(tr.data.review_date)}</small>
                </div>
              )}
              {onContinueCare && (
                <div className="pr-tc-actions">
                  <button
                    className="pr-chip-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContinueCare(tr, 'appointments');
                    }}
                  >
                    <Calendar size={12} /> Schedule Visit
                  </button>
                  <button
                    className="pr-chip-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      onContinueCare(tr, 'emr');
                    }}
                  >
                    <FileText size={12} /> Encounter
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 16. BESPOKE RECORD DETAIL MODAL (REPLACES GENERIC DL)
// ============================================================================
export function PracticeRecordDetailView({
  record,
  module,
  patients,
  patientNames
}: {
  record: PracticeRecord;
  module: PracticeModule;
  patients: PracticeRecord[];
  patientNames: Record<string, string>;
}) {
  const patient = patients.find(p => p.id === record.data.patient_id);
  const patientName = patient?.title || patientNames[record.data.patient_id] || record.data.patient_id || '';

  // 1. COMMUNICATIONS DETAIL (Exactly from the user's screenshot!)
  if (record.module === 'communications') {
    const channel = record.data.channel || 'SMS';
    return (
      <div className="pr-bespoke-detail pr-comm-detail-view">
        {/* Channel Banner */}
        <div className="pr-dt-channel-header">
          <span className={`pr-channel-pill large ${channel.toLowerCase()}`}>
            {channel === 'WhatsApp' ? <MessageSquare size={16} /> : channel === 'Email' ? <Mail size={16} /> : <Phone size={16} />}
            {channel} Communication
          </span>
          <span className={`pr-badge ${record.status === 'Ready' ? 'good' : 'pending'}`}>
            {record.status}
          </span>
        </div>

        {/* Recipient & Schedule Row */}
        <div className="pr-dt-meta-grid">
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">RECIPIENT PATIENT</span>
            <div className="pr-dt-patient-val">
              <User size={15} />
              <strong>{patientName || 'Direct Recipient'}</strong>
            </div>
            {patient?.data.phone && <small><Phone size={11} /> {patient.data.phone}</small>}
            {patient?.data.email && <small><Mail size={11} /> {patient.data.email}</small>}
          </div>

          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">SCHEDULED DELIVERY</span>
            <div className="pr-dt-time-val">
              <Clock size={15} />
              <strong>{record.data.scheduled_at ? stamp(record.data.scheduled_at) : 'Drafted / Immediate'}</strong>
            </div>
            <small>Attributed to staff account</small>
          </div>
        </div>

        {/* Live Rendered Message Document */}
        <div className="pr-dt-rendered-doc">
          <div className="pr-dt-rendered-title">
            <Send size={15} />
            <span>Outbound Message Payload</span>
          </div>

          {channel === 'Email' ? (
            <div className="pr-dt-email-card">
              <div className="pr-dt-email-header">
                <div><span>From:</span> <strong>Medora Care Practice &lt;care@medora.clinic&gt;</strong></div>
                <div><span>To:</span> <strong>{patientName}</strong></div>
                <div><span>Subject:</span> <strong>{record.title}</strong></div>
              </div>
              <div className="pr-dt-email-body">
                <p>{record.data.message}</p>
                <div className="pr-dt-email-sig">
                  <p>Warm regards,<br /><strong>Medora Practice Care Team</strong></p>
                </div>
              </div>
            </div>
          ) : (
            <div className={`pr-dt-bubble-card ${channel.toLowerCase()}`}>
              <div className="pr-dt-bubble-sender">
                <strong>{channel === 'WhatsApp' ? 'Medora Healthcare (Verified)' : 'MEDORA-CLINIC'}</strong>
                <time>{record.data.scheduled_at ? stamp(record.data.scheduled_at) : 'Now'}</time>
              </div>
              <p className="pr-dt-bubble-text">{record.data.message}</p>
              <div className="pr-dt-bubble-ticks">
                {channel === 'WhatsApp' ? '✓✓ Delivered' : 'SMS Carrier Sent'}
              </div>
            </div>
          )}
        </div>

        <div className="pr-dt-disclaimer">
          <ShieldCheck size={14} />
          <span>Fictional sample in demonstration mode. In live mode, messages dispatch via verified SMS / WhatsApp / Email gateway.</span>
        </div>
      </div>
    );
  }

  // 2. CLAIMS DETAIL (Finance)
  if (record.module === 'claims') {
    return (
      <div className="pr-bespoke-detail pr-claim-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <span className="pr-payer-pill large"><Landmark size={15} /> {record.data.payer || 'Payer Clearinghouse'}</span>
            <span className={`pr-badge ${record.status === 'Approved' ? 'good' : record.status === 'Rejected' ? 'muted' : 'pending'}`}>
              {record.status}
            </span>
          </div>
          <div className="pr-dt-hero-money">
            <small>TOTAL CLAIM AMOUNT</small>
            <h2>{money(record.data.amount, record.data.currency)}</h2>
            {record.data.policy && <span>Policy Ref: <strong>{record.data.policy}</strong></span>}
          </div>
        </div>

        <div className="pr-dt-meta-grid">
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">PATIENT / BENEFICIARY</span>
            <strong>{patientName}</strong>
          </div>
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">ADJUDICATION STATUS</span>
            <strong>{record.status}</strong>
          </div>
        </div>

        {record.data.coding && (
          <div className="pr-dt-coding-box">
            <span className="pr-dt-label">MEDICAL DIAGNOSTIC & PROCEDURE CODES</span>
            <div className="pr-dt-coding-chips">
              {record.data.coding.split('\n').filter(Boolean).map((code, i) => (
                <span key={i} className="pr-code-chip"><Tag size={12} /> {code}</span>
              ))}
            </div>
          </div>
        )}

        {record.data.decision && (
          <div className="pr-dt-decision-box">
            <span className="pr-dt-label">REMITTANCE & ADJUDICATION REMARKS</span>
            <p>{record.data.decision}</p>
          </div>
        )}
      </div>
    );
  }

  // 3. INVENTORY DETAIL (Operations)
  if (record.module === 'inventory') {
    const qty = Number(record.data.quantity || 0);
    const reorder = Number(record.data.reorder || 10);
    const isLow = qty <= reorder;
    return (
      <div className="pr-bespoke-detail pr-inv-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <span className="pr-inv-cat"><Tag size={14} /> {record.data.category || 'Asset'}</span>
            <span className="pr-sku-tag large">SKU: {record.data.sku}</span>
          </div>
          <h2>{record.title}</h2>
        </div>

        <div className="pr-dt-stock-gauge-box">
          <div className="pr-dt-gauge-header">
            <span>Usable Stock Level</span>
            <strong>{qty} {record.data.unit || 'Units'}</strong>
          </div>
          <div className="pr-ph-meter large">
            <div
              className={`pr-ph-fill ${isLow ? 'low' : 'good'}`}
              style={{ width: `${Math.min(100, Math.max(10, (qty / (reorder * 3)) * 100))}%` }}
            />
          </div>
          <small className={isLow ? 'pr-alert-text' : 'pr-good-text'}>
            {isLow ? `Low stock alert (Threshold: ${reorder})` : `Healthy inventory level (Above threshold ${reorder})`}
          </small>
        </div>

        {record.data.notes && (
          <div className="pr-dt-notes-box">
            <span className="pr-dt-label">STOCK CONTROL NOTES</span>
            <p>{record.data.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // 4. CRM DETAIL (Engagement)
  if (record.module === 'crm') {
    const consent = record.data.marketing_consent || 'Not granted';
    const isGranted = consent === 'Granted';
    return (
      <div className="pr-bespoke-detail pr-crm-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <span className={`pr-badge ${record.status === 'Converted' ? 'good' : 'pending'}`}>
              Lead Stage: {record.status}
            </span>
            <span className={`pr-consent-pill large ${isGranted ? 'granted' : 'pending'}`}>
              {isGranted ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              Marketing Consent: {consent}
            </span>
          </div>
          <h2>{record.title}</h2>
          <div className="pr-dt-contact-row">
            <Phone size={14} /> <strong>{record.data.contact}</strong>
            {record.data.source && <span className="pr-crm-source">via {record.data.source}</span>}
          </div>
        </div>

        {record.data.follow_up && (
          <div className="pr-dt-followup-card">
            <Calendar size={16} />
            <div>
              <strong>Follow-Up Scheduled</strong>
              <small>{dateOnly(record.data.follow_up)}</small>
            </div>
          </div>
        )}

        {record.data.notes && (
          <div className="pr-dt-notes-box">
            <span className="pr-dt-label">ENQUIRY & COMMUNICATION LOG</span>
            <p>{record.data.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // 5. HR DETAIL (Operations)
  if (record.module === 'hr') {
    return (
      <div className="pr-bespoke-detail pr-hr-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <span className={`pr-hr-type-pill large ${record.data.type?.toLowerCase() || 'attendance'}`}>
              {record.data.type || 'Attendance Shift'}
            </span>
            <span className={`pr-badge ${record.status === 'Approved' ? 'good' : record.status === 'Declined' ? 'muted' : 'pending'}`}>
              {record.status}
            </span>
          </div>
          <h2>{record.title}</h2>
        </div>

        <div className="pr-dt-meta-grid">
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">RECORD TYPE</span>
            <strong>{record.data.type}</strong>
          </div>
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">APPROVAL STATE</span>
            <strong>{record.status}</strong>
          </div>
        </div>

        <div className="pr-dt-interval-box">
          <span className="pr-dt-label">SCHEDULED INTERVAL</span>
          <div className="pr-dt-interval-row">
            <Clock size={16} />
            <div>
              <span>From: <strong>{record.data.starts_at ? stamp(record.data.starts_at) : '—'}</strong></span>
              <span>To: <strong>{record.data.ends_at ? stamp(record.data.ends_at) : '—'}</strong></span>
            </div>
          </div>
        </div>

        {record.data.notes && (
          <div className="pr-dt-notes-box">
            <span className="pr-dt-label">ATTENDANCE / LEAVE NOTES</span>
            <p>{record.data.notes}</p>
          </div>
        )}
      </div>
    );
  }

  // 6. CONSENT & FEEDBACK DETAIL (Engagement)
  if (record.module === 'consent') {
    return (
      <div className="pr-bespoke-detail pr-consent-detail-view">
        <div className="pr-dt-certificate-header">
          <Shield size={24} />
          <div>
            <h2>Medico-Legal Consent & Feedback Record</h2>
            <small>Record ID: {record.id.slice(0, 8)} · Type: {record.data.type}</small>
          </div>
          <span className={`pr-badge ${record.status === 'Recorded' ? 'good' : 'muted'}`}>
            {record.status}
          </span>
        </div>

        <div className="pr-dt-meta-grid">
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">PATIENT / SUBJECT</span>
            <strong>{patientName}</strong>
          </div>
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">VERIFIED RECORDING STAFF</span>
            <strong>{record.data.recorded_by}</strong>
            {record.data.date && <small>Date: {dateOnly(record.data.date)}</small>}
          </div>
        </div>

        <div className="pr-dt-evidence-container">
          <span className="pr-dt-label">DOCUMENTED CONSENT EVIDENCE & SCOPE</span>
          <div className="pr-dt-evidence-body">
            <p>{record.data.evidence}</p>
          </div>
        </div>
      </div>
    );
  }

  // 7. TEMPLATES DETAIL (Settings)
  if (record.module === 'templates') {
    return (
      <div className="pr-bespoke-detail pr-tmpl-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <span className="pr-tmpl-specialty large">{record.data.specialty || 'General'}</span>
            <span className={`pr-badge ${record.status === 'Published' ? 'good' : 'muted'}`}>
              {record.status}
            </span>
          </div>
          <h2>{record.title}</h2>
          <span className="pr-tmpl-type"><FileText size={13} /> {record.data.type} Template</span>
        </div>

        <div className="pr-dt-tmpl-spec">
          <span className="pr-dt-label">CLINICAL TEMPLATE SPECIFICATION</span>
          <pre className="pr-dt-tmpl-content">{record.data.content}</pre>
        </div>
      </div>
    );
  }

  // 8. BRANCH LOCATIONS DETAIL (Settings)
  if (record.module === 'locations') {
    return (
      <div className="pr-bespoke-detail pr-loc-detail-view">
        <div className="pr-dt-hero-card">
          <div className="pr-dt-hero-top">
            <div className="pr-loc-icon large"><Building2 size={22} /></div>
            <span className={`pr-badge ${record.status === 'Active' ? 'good' : 'muted'}`}>
              {record.status}
            </span>
          </div>
          <h2>{record.title}</h2>
          <div className="pr-loc-tz large"><Clock size={15} /> Timezone: <strong>{record.data.timezone}</strong></div>
        </div>

        {record.data.address && (
          <div className="pr-dt-meta-box">
            <span className="pr-dt-label">FACILITY ADDRESS</span>
            <div className="pr-loc-address"><MapPin size={15} /> <strong>{record.data.address}</strong></div>
          </div>
        )}

        {record.data.hours && (
          <div className="pr-dt-notes-box">
            <span className="pr-dt-label">OPERATING HOURS</span>
            <p>{record.data.hours}</p>
          </div>
        )}
      </div>
    );
  }

  // Fallback for any other record: clean grid of field cards rather than generic plain text
  return (
    <div className="pr-bespoke-detail pr-generic-detail-view">
      <div className="pr-dt-field-grid">
        {module.fields.map(f => {
          const raw = record.data[f.key];
          if (!raw) return null;
          const display = f.kind === 'patient'
            ? patientName
            : f.kind === 'datetime-local'
              ? stamp(raw)
              : raw;
          return (
            <div key={f.key} className={`pr-dt-field-item ${f.kind === 'textarea' ? 'wide' : ''}`}>
              <span className="pr-dt-label">{f.label.toUpperCase()}</span>
              <strong>{display}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

