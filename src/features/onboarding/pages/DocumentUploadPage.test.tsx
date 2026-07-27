import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { getFunctionName } from 'convex/server'
import { DocumentUploadPage } from './DocumentUploadPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' }, isLoaded: true }),
  useClerk: () => ({ signOut: vi.fn() }),
}))

vi.mock('@/shared/lib/upload', () => ({
  uploadFileToConvex: vi.fn().mockResolvedValue('storage-123'),
}))

const attachMock = vi.fn().mockResolvedValue('file-1')
const saveSignedPrefilledDocumentMock = vi.fn().mockResolvedValue('doc-1')

function createTasks(type: string) {
  return [{ _id: `task_${type}`, type, status: 'pending' }]
}

function createApplicationData() {
  return {
    candidate: { _id: 'candidate-1' },
    application: {
      fields: {
        personal: {
          firstName: 'E2E',
          lastName: 'Candidate',
          address: { street: '123 Main St', apt: '', city: 'San Jose', state: 'CA', zip: '95131' },
          positionApplyingFor: 'Caregiver',
          ssn: '123-45-6789',
          dateOfBirth: '1990-06-15',
        },
        i9: { ssn: '123-45-6789', dateOfBirth: '1990-06-15' },
        w4: { ssn: '123-45-6789' },
      },
    },
  }
}

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn().mockImplementation(() => createTasks('photo_id')),
  useMutation: vi.fn().mockImplementation((mutation) => {
    const name = getFunctionName(mutation as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:attachCandidateDocument') return attachMock
    if (name === 'candidates:saveSignedPrefilledDocument') return saveSignedPrefilledDocumentMock
    return vi.fn()
  }),
}))

const file = new File(['id'], 'license.png', { type: 'image/png' })

describe('DocumentUploadPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(() => createTasks('photo_id'))
  })

  it('uploads a file and attaches it with the task type', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/onboarding/upload/task_photo_id']}>
        <Routes>
          <Route path='/onboarding/upload/:taskId' element={<DocumentUploadPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Upload photo ID')).toBeInTheDocument()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.change(screen.getByLabelText(/EXPIRY DATE/i), {
      target: { value: '12/31/2026' },
    })

    // Select photo ID type first
    fireEvent.click(screen.getByText("Driver's License"))

    fireEvent.click(screen.getByRole('button', { name: /Submit document/i }))

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        storageId: 'storage-123',
        fileName: 'license.png',
        contentType: 'image/png',
        size: 2,
        documentType: 'photo_id',
        label: "Upload photo ID (Driver's License)",
        expiresAt: '2026-12-31',
        photoIdType: 'drivers_license',
      })
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })

    expect(saveSignedPrefilledDocumentMock).not.toHaveBeenCalled()
  })

  it('saves signed prefilled document after health screen upload', async () => {
    const { useQuery } = vi.mocked(await import('convex/react'))
    useQuery.mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:listCandidateTasks') return createTasks('health_screen')
        if (name === 'candidates:getMyApplication') return createApplicationData()
        return undefined
      }) as unknown as typeof useQuery,
    )

    const { container } = render(
      <MemoryRouter initialEntries={['/onboarding/upload/health_screen']}>
        <Routes>
          <Route path='/onboarding/upload/:taskId' element={<DocumentUploadPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Upload signed health screen')).toBeInTheDocument()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /Submit document/i }))

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        storageId: 'storage-123',
        fileName: 'license.png',
        contentType: 'image/png',
        size: 2,
        documentType: 'health_screen',
        label: 'Upload signed health screen',
        expiresAt: undefined,
        photoIdType: undefined,
      })
    })

    await waitFor(() => {
      expect(saveSignedPrefilledDocumentMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        documentType: 'health_screen',
        storageId: 'storage-123',
      })
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })

  it('saves signed prefilled document as live_scan after background check upload', async () => {
    const { useQuery } = vi.mocked(await import('convex/react'))
    useQuery.mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:listCandidateTasks') return createTasks('background_check')
        if (name === 'candidates:getMyApplication') return createApplicationData()
        return undefined
      }) as unknown as typeof useQuery,
    )

    const { container } = render(
      <MemoryRouter initialEntries={['/onboarding/upload/background_check']}>
        <Routes>
          <Route path='/onboarding/upload/:taskId' element={<DocumentUploadPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Upload stamped Live Scan receipt')).toBeInTheDocument()

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.click(screen.getByRole('button', { name: /Submit document/i }))

    await waitFor(() => {
      expect(saveSignedPrefilledDocumentMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        documentType: 'live_scan',
        storageId: 'storage-123',
      })
    })
  })
})
