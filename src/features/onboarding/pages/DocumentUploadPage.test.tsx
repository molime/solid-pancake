import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
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
}))

vi.mock('@/shared/lib/upload', () => ({
  uploadFileToConvex: vi.fn().mockResolvedValue('storage-123'),
}))

const attachMock = vi.fn().mockResolvedValue('file-1')

vi.mock('convex/react', () => ({
  useQuery: () => [
    { _id: 'task_photo_id', type: 'photo_id', status: 'pending' },
    { _id: 'task_cpr', type: 'cpr_certificate', status: 'pending' },
  ],
  useMutation: () => attachMock,
}))

const file = new File(['id'], 'license.png', { type: 'image/png' })

describe('DocumentUploadPage', () => {
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
      target: { value: '2026-12-31' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Submit document/i }))

    await waitFor(() => {
      expect(attachMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        storageId: 'storage-123',
        fileName: 'license.png',
        contentType: 'image/png',
        size: 2,
        documentType: 'photo_id',
        label: 'Upload photo ID',
        expiresAt: '2026-12-31',
      })
    })

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true })
    })
  })
})
