import { useEffect, useMemo, useState } from 'react'
import { eventsRequest } from '../data/eventsApi'

type Applicant = {
  _id: string
  user?: { username: string; email: string }
  inviteEmail?: string
  type: 'registered' | 'invited'
  status: 'pending' | 'confirmed' | 'cancelled' | 'waitlisted'
  checkedIn: boolean
  checkedInAt?: string
  createdAt: string
}

type ApplicantsPanelProps = { eventId: string; token: string }

function ApplicantsPanel({ eventId, token }: ApplicantsPanelProps) {
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | Applicant['type']>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    eventsRequest<{ registrations: Applicant[] }>(`/${eventId}/applicants`, token)
      .then((result) => setApplicants(result.registrations))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Could not load applicants.'))
      .finally(() => setLoading(false))
  }, [eventId, token])

  const filteredApplicants = useMemo(() => {
    const term = query.trim().toLowerCase()
    return applicants.filter((applicant) => (typeFilter === 'all' || applicant.type === typeFilter)
      && `${applicant.user?.username || applicant.inviteEmail || ''} ${applicant.user?.email || ''} ${applicant.type} ${applicant.status}`.toLowerCase().includes(term))
  }, [applicants, query, typeFilter])

  function exportCsv() {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
    const rows = [
      ['Username', 'Email', 'Type', 'Status', 'Registered at', 'Checked in at'],
      ...filteredApplicants.map((applicant) => [
        applicant.user?.username || applicant.inviteEmail || '',
        applicant.user?.email || applicant.inviteEmail || '',
        applicant.type,
        applicant.status,
        new Date(applicant.createdAt).toISOString(),
        applicant.checkedInAt ? new Date(applicant.checkedInAt).toISOString() : '',
      ]),
    ]
    const file = new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = 'event-applicants.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div><span className="section-eyebrow">Attendance</span><h2>People at your event.</h2></div>
        <span className="workspace-panel-count">{applicants.length} applicants</span>
      </div>
      <div className="applicants-tools">
        <label className="workspace-search"><span aria-hidden="true">⌕</span><input aria-label="Search applicants" onChange={(input) => setQuery(input.target.value)} placeholder="Search username or email" type="search" value={query} /></label>
        <select aria-label="Filter applicant type" onChange={(input) => setTypeFilter(input.target.value as typeof typeFilter)} value={typeFilter}><option value="all">All types</option><option value="registered">Registered</option><option value="invited">Invited</option></select>
        <button className="workspace-resend" onClick={exportCsv} type="button">Export CSV</button>
      </div>
      {loading ? <p>Loading applicants…</p> : error ? <p role="alert">{error}</p> : (
        <div className="workspace-table" role="table" aria-label="Event applicants">
          <div className="workspace-table-row workspace-table-header" role="row"><span>Username</span><span>Email</span><span>Type / status</span><span>Registered / check-in</span></div>
          {filteredApplicants.map((applicant) => (
            <div className="workspace-table-row applicants-row" key={applicant._id} role="row">
              <strong>{applicant.user?.username || applicant.inviteEmail || 'Invite pending'}</strong><span>{applicant.user?.email || applicant.inviteEmail || '—'}</span>
              <span>{applicant.type === 'invited' ? 'Invited' : 'Registered'} · {applicant.status}</span>
              <span>{new Date(applicant.createdAt).toLocaleDateString()}{applicant.checkedInAt ? ` · Checked in ${new Date(applicant.checkedInAt).toLocaleTimeString()}` : applicant.checkedIn ? ' · Checked in' : ' · Not checked in'}</span>
            </div>
          ))}
          {!filteredApplicants.length && <p>No applicants match this search.</p>}
        </div>
      )}
    </section>
  )
}

export default ApplicantsPanel
