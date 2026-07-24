import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getFunctionName } from 'convex/server'
import { ApplicationFormPage } from './pages/ApplicationFormPage'
import { mergeDraft, prefilledI9FromPersonal, prefilledW4FromPersonal } from './pages/applicationUtils'
import { createDefaultApplicationFormData } from './components/application/types'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123', name: 'Atria Care' }, isLoaded: true }),
  useUser: () => ({
    user: {
      fullName: 'Sofia Herrera',
      primaryEmailAddress: { emailAddress: 'sofia@atriax.example' },
    },
    isLoaded: true,
  }),
}))

const submitMock = vi.fn().mockResolvedValue('candidate-1')

const candidateProfile = {
  _id: 'candidate-1',
  displayName: 'Sofia Herrera',
  email: 'sofia@atriax.example',
  phone: '555-000-0000',
}

vi.mock('convex/react', () => ({
  useQuery: (query: unknown) => {
    const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:getCandidateProfile') return candidateProfile
    if (name === 'drafts:getDraft') return null
    if (name === 'candidates:getMyApplication') return { candidate: candidateProfile, application: null, tasks: [] }
    if (name === 'agencyConfig:listAgencyBranches') return []
    return undefined
  },
  useMutation: () => submitMock,
}))

function agreeToJobDescription() {
  fireEvent.click(screen.getByLabelText(/I have read and understand the job description/i))
  fireEvent.click(screen.getByLabelText(/same legal validity as a handwritten signature/i))
}

function clickContinue() {
  fireEvent.click(screen.getByRole('button', { name: /Save and continue/i }))
}

function fillPersonal() {
  fireEvent.change(screen.getByLabelText(/ID type/i), { target: { value: 'ssn' } })
  fireEvent.change(screen.getByLabelText(/SSN \/ ITIN/i), { target: { value: '123-45-6789' } })
  fireEvent.change(screen.getByLabelText(/Street address/i), { target: { value: '123 Main St' } })
  fireEvent.change(screen.getByLabelText(/City/i), { target: { value: 'Los Angeles' } })
  fireEvent.change(screen.getByLabelText(/State/i), { target: { value: 'CA' } })
  fireEvent.change(screen.getByLabelText(/ZIP/i), { target: { value: '90001' } })
  fireEvent.change(screen.getByLabelText(/Cell phone/i), { target: { value: '555-123-4567' } })
  fireEvent.change(screen.getByLabelText(/Date of birth/i), { target: { value: '1990-01-01' } })
  fireEvent.click(screen.getByLabelText(/I am 18 years of age or older/i))
  fireEvent.change(screen.getByLabelText(/Position applying for/i), { target: { value: 'Caregiver' } })
  fireEvent.change(screen.getByLabelText(/Availability/i), { target: { value: 'full_time' } })
  fireEvent.click(screen.getByLabelText(/Morning \(7am-3pm\)/i))
  fireEvent.click(screen.getByLabelText('Monday'))
}

function fillEmployment() {
  fireEvent.change(screen.getByLabelText(/Company name/i), { target: { value: 'Sunrise Care' } })
  fireEvent.change(screen.getByLabelText(/Position/i), { target: { value: 'Caregiver' } })
  fireEvent.change(screen.getByLabelText(/From \(MM\/YYYY\)/i), { target: { value: '01/2020' } })
  fireEvent.change(screen.getByLabelText(/Job duties/i), { target: { value: 'Personal care' } })
}

function fillReferences() {
  fireEvent.change(screen.getAllByLabelText(/Full name/i)[0], { target: { value: 'Maria Lopez' } })
  fireEvent.change(screen.getAllByLabelText(/^Phone/i)[0], { target: { value: '555-999-8888' } })
  fireEvent.change(screen.getByLabelText(/Relationship/i), { target: { value: 'Supervisor' } })
}

function fillI9() {
  const addresses = screen.getAllByLabelText(/^Address/i)
  const cities = screen.getAllByLabelText(/^City/i)
  const states = screen.getAllByLabelText(/^State/i)
  const zips = screen.getAllByLabelText(/^ZIP/i)
  const ssns = screen.getAllByLabelText(/^SSN/i)
  const signatures = screen.getAllByLabelText(/^Signature/i)
  const dates = screen.getAllByLabelText('Date*')

  fireEvent.change(addresses[0], { target: { value: '123 Main St' } })
  fireEvent.change(cities[0], { target: { value: 'Los Angeles' } })
  fireEvent.change(states[0], { target: { value: 'CA' } })
  fireEvent.change(zips[0], { target: { value: '90001' } })
  fireEvent.change(screen.getByLabelText(/^Date of birth/i), { target: { value: '1990-01-01' } })
  fireEvent.change(ssns[0], { target: { value: '123-45-6789' } })
  fireEvent.change(screen.getByLabelText(/Citizenship status/i), { target: { value: 'citizen' } })
  fireEvent.change(signatures[0], { target: { value: 'Sofia Herrera' } })
  fireEvent.change(dates[0], { target: { value: '2026-01-15' } })
}

function fillW4() {
  const addresses = screen.getAllByLabelText(/^Address/i)
  const ssns = screen.getAllByLabelText(/^SSN/i)
  const signatures = screen.getAllByLabelText(/^Signature/i)
  const dates = screen.getAllByLabelText('Date*')

  fireEvent.change(addresses[1], { target: { value: '123 Main St' } })
  fireEvent.change(screen.getByLabelText(/City, state, ZIP/i), { target: { value: 'Los Angeles, CA 90001' } })
  fireEvent.change(ssns[1], { target: { value: '123-45-6789' } })
  fireEvent.change(screen.getByLabelText(/Filing status/i), { target: { value: 'single' } })
  fireEvent.change(signatures[1], { target: { value: 'Sofia Herrera' } })
  fireEvent.change(dates[1], { target: { value: '2026-01-15' } })
}

function fillDisbursement() {
  fireEvent.change(screen.getByLabelText(/Payment method/i), { target: { value: 'check' } })
}

function fillAcknowledgments() {
  const docs = ['Job Description', 'Employee Contract', 'Employee Rights', 'HIPAA', 'Abuse']
  for (const doc of docs) {
    fireEvent.click(screen.getByLabelText(new RegExp(`I have read and agree to the ${doc}`, 'i')))
  }

  const initialsInputs = screen.getAllByLabelText(/^Initials/i)
  const dateInputs = screen.getAllByLabelText('Date*')
  for (let i = 0; i < docs.length; i++) {
    fireEvent.change(initialsInputs[i], { target: { value: 'SH' } })
    fireEvent.change(dateInputs[i], { target: { value: '2026-01-15' } })
  }
}

describe('createDefaultApplicationFormData', () => {
  it('defaults I-9, W-4 and acknowledgment dates to today', () => {
    const today = new Date().toISOString().split('T')[0]
    const data = createDefaultApplicationFormData()
    expect(data.i9.date).toBe(today)
    expect(data.w4.date).toBe(today)
    expect(data.acknowledgments.jobDescription.date).toBe(today)
    expect(data.acknowledgments.employeeContract.date).toBe(today)
    expect(data.acknowledgments.employeeRights.date).toBe(today)
    expect(data.acknowledgments.hipaa.date).toBe(today)
    expect(data.acknowledgments.abuseNotice.date).toBe(today)
  })

  it('prefills personal info when provided', () => {
    const data = createDefaultApplicationFormData({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-000-0000',
    })
    expect(data.personal.firstName).toBe('Jane')
    expect(data.personal.lastName).toBe('Doe')
    expect(data.personal.email).toBe('jane@example.com')
    expect(data.personal.homePhone).toBe('555-000-0000')
    expect(data.i9.firstName).toBe('Jane')
    expect(data.i9.lastName).toBe('Doe')
    expect(data.w4.firstName).toBe('Jane')
    expect(data.w4.lastName).toBe('Doe')
  })

  it('merges saved draft data without overwriting defaults', () => {
    const base = createDefaultApplicationFormData()
    const draft = {
      personal: { firstName: 'Saved' },
      i9: { address: '456 Oak St' },
      employment: [{ companyName: 'Draft Co' }],
    }
    const merged = mergeDraft(base, draft)
    expect(merged.personal.firstName).toBe('Saved')
    expect(merged.personal.lastName).toBe('')
    expect(merged.i9.address).toBe('456 Oak St')
    expect(merged.i9.date).toBe(base.i9.date)
    expect(merged.employment[0].companyName).toBe('Draft Co')
  })

  it('propagates personal address into I-9 fields', () => {
    const personal = createDefaultApplicationFormData().personal
    personal.address = {
      street: '123 Main St',
      apt: 'Apt 4',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    }
    const i9 = prefilledI9FromPersonal(personal, createDefaultApplicationFormData().i9)
    expect(i9.address).toBe('123 Main St')
    expect(i9.aptNumber).toBe('Apt 4')
    expect(i9.city).toBe('Los Angeles')
    expect(i9.state).toBe('CA')
    expect(i9.zip).toBe('90001')
  })

  it('propagates personal address into W-4 fields', () => {
    const personal = createDefaultApplicationFormData().personal
    personal.address = {
      street: '123 Main St',
      apt: 'Apt 4',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
    }
    const w4 = prefilledW4FromPersonal(personal, createDefaultApplicationFormData().w4)
    expect(w4.address).toBe('123 Main St Apt 4')
    expect(w4.cityStateZip).toBe('Los Angeles, CA 90001')
  })

  it('defaults criminal record questions to No', () => {
    const data = createDefaultApplicationFormData()
    expect(data.criminalRecord.convictedCalifornia).toBe(false)
    expect(data.criminalRecord.convictedOther).toBe(false)
    expect(data.criminalRecord.convictedUnderAlias).toBe(false)
  })
})

describe('ApplicationFormPage', () => {
  it('renders the multi-step application and submits all sections', async () => {
    render(
      <MemoryRouter>
        <ApplicationFormPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Job application')).toBeInTheDocument()

    agreeToJobDescription()
    clickContinue()

    // Fill gender first
    await waitFor(() => {
      const genderSelect = document.querySelector('select#gender') as HTMLSelectElement
      if (genderSelect) {
        fireEvent.change(genderSelect, { target: { value: 'male' } })
      }
    })

    fillPersonal()
    clickContinue()

    fillEmployment()
    fillReferences()
    clickContinue()

    clickContinue()

    fillI9()
    fillW4()
    clickContinue()

    fillDisbursement()
    clickContinue()

    fillAcknowledgments()
    clickContinue()

    fireEvent.click(screen.getByRole('button', { name: /Submit application/i }))

    await waitFor(() => {
      expect(submitMock).toHaveBeenCalled()
    })

    const call = submitMock.mock.calls[0][0]
    expect(call.clerkOrgId).toBe('org_123')
    expect(call.fields.personal.firstName).toBe('Sofia')
    expect(call.fields.personal.lastName).toBe('Herrera')
    expect(call.fields.personal.email).toBe('sofia@atriax.example')
    expect(call.fields.employment[0].companyName).toBe('Sunrise Care')
    expect(call.fields.references[0].name).toBe('Maria Lopez')
    expect(call.fields.i9.citizenshipStatus).toBe('citizen')
    expect(call.fields.w4.filingStatus).toBe('single')
    expect(call.fields.disbursement.method).toBe('check')
    expect(call.fields.legalValidityAccepted).toBe(true)
    expect(call.fields.acknowledgments.jobDescription.agreed).toBe(true)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding/status', { replace: true })
    })
  })
})
