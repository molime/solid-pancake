import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ApplicationReviewPage } from './ApplicationReviewPage'
import { getFunctionName } from 'convex/server'

vi.mock('@clerk/react', () => ({
  useOrganization: () => ({ organization: { id: 'org_123' } }),
  useUser: () => ({ user: { fullName: 'HR Person' } }),
}))

const reviewApplicationMock = vi.fn()
const sendOfferMock = vi.fn()
const downloadUrlMock = vi.fn()
const addCandidateNoteMock = vi.fn()
const updateCandidateNoteMock = vi.fn()
const deleteCandidateNoteMock = vi.fn()

function createDetailResponse(options?: {
  status?: string
  tasks?: unknown[]
  documents?: unknown[]
  fields?: Record<string, unknown>
}) {
  const status = options?.status ?? 'applied'
  return {
    candidate: {
      _id: 'cand_1',
      displayName: 'Jane Doe',
      status,
      email: 'jane@example.com',
      createdAt: '2026-07-09T10:00:00.000Z',
    },
    applications: [
      {
        fields: {
          position: 'Caregiver',
          payRate: '$22.00 / hr',
          startDate: '2026-08-01',
          schedule: 'Flexible',
          supervisor: 'Coordinator',
          offerExpiresAt: '2026-08-15',
          ...options?.fields,
        },
        submittedAt: '2026-07-09T10:00:00.000Z',
      },
    ],
    tasks: options?.tasks ?? [],
    documents: options?.documents ?? [
      {
        _id: 'doc_1',
        category: 'photo_id',
        status: 'active',
        fileName: 'license.png',
        storageId: 'storage-1',
        expiresAt: '2027-12-31',
      },
    ],
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function defaultUseQueryImplementation(query: unknown, _args?: unknown) {
  const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
  if (name === 'candidates:getCandidateDetail') return createDetailResponse()
  if (name === 'candidates:listCandidateTasksForHR') return []
  if (name === 'candidates:listCandidateNotes') return []
  if (name === 'files:getDownloadUrl') {
    downloadUrlMock()
    return 'https://example.com/download/storage-1'
  }
  return undefined
}

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
  useQuery: vi.fn().mockImplementation(defaultUseQueryImplementation),
  useMutation: vi.fn().mockImplementation((mutation) => {
    const name = getFunctionName(mutation as Parameters<typeof getFunctionName>[0])
    if (name === 'candidates:reviewApplication') return reviewApplicationMock
    if (name === 'candidates:sendOffer') return sendOfferMock
    if (name === 'candidates:addCandidateNote') return addCandidateNoteMock
    if (name === 'candidates:updateCandidateNote') return updateCandidateNoteMock
    if (name === 'candidates:deleteCandidateNote') return deleteCandidateNoteMock
    return vi.fn()
  }),
}))

vi.mock('../components/HrToast', () => ({
  HrToast: () => null,
}))

describe('ApplicationReviewPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    reviewApplicationMock.mockResolvedValue(undefined)
    sendOfferMock.mockResolvedValue(undefined)
    addCandidateNoteMock.mockResolvedValue('note_new')
    updateCandidateNoteMock.mockResolvedValue('note_1')
    deleteCandidateNoteMock.mockResolvedValue('note_1')
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(defaultUseQueryImplementation)
  })

  it('shows signed upload status and download link for prefilled documents', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') return createDetailResponse()
        if (name === 'candidates:listCandidateTasksForHR') return []
        if (name === 'candidates:getPrefilledDocuments') {
          return [
            {
              _id: 'prefilled_health',
              documentType: 'health_screen',
              storageId: 'storage-health',
              uploadedSignedStorageId: 'storage-health-signed',
            },
            {
              _id: 'prefilled_live_scan',
              documentType: 'live_scan',
              storageId: 'storage-live-scan',
              uploadedSignedStorageId: undefined,
            },
          ]
        }
        if (name === 'candidates:getPrefilledDocumentDownloadUrl') {
          return 'https://example.com/download/prefilled'
        }
        if (name === 'files:getDownloadUrl') {
          downloadUrlMock()
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Health Screen (LIC 503)')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Live Scan (LIC 9163)')).toBeInTheDocument()
    })

    const prefilledSection = screen.getByText('Prefilled documents').closest('div') as HTMLElement
    await waitFor(() => {
      expect(within(prefilledSection).getAllByText('Received').length).toBeGreaterThanOrEqual(1)
    })

    expect(within(prefilledSection).getAllByText('Not uploaded').length).toBeGreaterThanOrEqual(1)
    expect(
      within(prefilledSection).getByRole('link', { name: /Download signed/i }),
    ).toHaveAttribute('href', 'https://example.com/download/prefilled')
  })

  it('shows a Download link for each uploaded document', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Photo identification')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Download/i })).toHaveAttribute(
        'href',
        'https://example.com/download/storage-1',
      )
    })

    expect(downloadUrlMock).toHaveBeenCalled()
  })

  it('labels a passport photo ID with its captured ID type', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            documents: [
              {
                _id: 'doc_1',
                category: 'photo_id',
                status: 'active',
                fileName: 'passport.png',
                storageId: 'storage-1',
                expiresAt: '2027-12-31',
                photoIdType: 'passport',
              },
            ],
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') return []
        if (name === 'files:getDownloadUrl') {
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByText('Photo identification — Passport (US)'),
      ).toBeInTheDocument()
    })
  })

  it('labels the I-9 SSN field with the selected ID type', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            fields: {
              personal: { idType: 'itin' },
              i9: { ssn: '999-99-9999' },
            },
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') return []
        if (name === 'files:getDownloadUrl') {
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('ITIN')).toBeInTheDocument()
    })
    expect(screen.getByText('999-99-9999')).toBeInTheDocument()
  })

  it('renders combined approve and send offer button for applied status', async () => {
    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByTestId('approve-and-send-offer-button'),
      ).toHaveTextContent('Approve application & send offer')
    })
  })

  it('disables approve and send offer button when tasks are incomplete', async () => {
    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            tasks: [{ _id: 'task_1', status: 'pending', title: 'Background check' }],
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') {
          return [{ _id: 'task_1', status: 'pending', title: 'Background check' }]
        }
        if (name === 'files:getDownloadUrl') {
          downloadUrlMock()
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('approve-and-send-offer-button')).toBeDisabled()
    })
  })

  it('calls reviewApplication then sendOffer when approve and send offer is clicked', async () => {
    const user = userEvent.setup()

    const { useQuery } = await import('convex/react')
    vi.mocked(useQuery).mockImplementation(
      ((query: unknown) => {
        const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
        if (name === 'candidates:getCandidateDetail') {
          return createDetailResponse({
            tasks: [{ _id: 'task_1', status: 'complete', title: 'Background check' }],
            fields: {
              i9Section2: {
                documentTitle: 'US Passport',
                documentNumber: '123456789',
                expirationDate: '2030-01-01',
                employerSignature: 'HR Admin',
                date: '2026-07-09',
              },
            },
          })
        }
        if (name === 'candidates:listCandidateTasksForHR') {
          return [{ _id: 'task_1', status: 'complete', title: 'Background check' }]
        }
        if (name === 'candidates:getPrefilledDocuments') {
          return [
            {
              _id: 'prefilled_w4',
              documentType: 'w4',
              storageId: 'storage-w4',
              hrSectionCompleted: true,
            },
          ]
        }
        if (name === 'candidates:getW4ForHR') {
          return {
            application: {
              fields: {
                i9Section2: {
                  documentTitle: 'US Passport',
                  documentNumber: '123456789',
                  expirationDate: '2030-01-01',
                  employerSignature: 'HR Admin',
                  date: '2026-07-09',
                },
              },
            },
          }
        }
        if (name === 'backgroundChecks:getBackgroundCheckForHR') {
          return {
            provider: 'mock',
            status: 'clear',
            officialResultStorageId: 'storage-bg-result',
          }
        }
        if (name === 'files:getDownloadUrl') {
          downloadUrlMock()
          return 'https://example.com/download/storage-1'
        }
        return undefined
      }) as unknown as typeof useQuery,
    )

    render(
      <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
        <Routes>
          <Route
            path='/hr/candidates/:candidateId'
            element={<ApplicationReviewPage />}
          />
        </Routes>
      </MemoryRouter>,
    )

    const employerNameInput = await waitFor(() =>
      screen.getByLabelText(/employer name/i),
    )
    const einInput = screen.getByLabelText(/ein/i)
    await user.clear(employerNameInput)
    await user.type(employerNameInput, 'Test Agency')
    await user.clear(einInput)
    await user.type(einInput, '12-3456789')

    const button = await waitFor(() =>
      screen.getByTestId('approve-and-send-offer-button'),
    )
    expect(button).not.toBeDisabled()
    await user.click(button)

    await waitFor(() => {
      expect(reviewApplicationMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        candidateId: 'cand_1',
        decision: 'approved',
      })
    })

    await waitFor(() => {
      expect(sendOfferMock).toHaveBeenCalledWith({
        clerkOrgId: 'org_123',
        candidateId: 'cand_1',
        payRate: '$22.00 / hr',
        startDate: '2026-08-01',
        schedule: 'Flexible',
        supervisor: 'Coordinator',
        clientName: '',
        expiresAt: '2026-08-15',
      })
    })

    expect(reviewApplicationMock.mock.invocationCallOrder[0]).toBeLessThan(
      sendOfferMock.mock.invocationCallOrder[0],
    )
  })

  describe('candidate notes CRUD', () => {
    const existingNotes = [
      {
        _id: 'note_2',
        candidateId: 'cand_1',
        authorId: 'user_hr',
        authorName: 'HR Person',
        text: 'Called 10/10 — pending docs.',
        createdAt: '2026-10-10T12:00:00.000Z',
        updatedAt: '2026-10-10T12:00:00.000Z',
      },
      {
        _id: 'note_1',
        candidateId: 'cand_1',
        authorId: 'user_hr',
        authorName: 'HR Person',
        text: 'Strong applicant, fast-track.',
        createdAt: '2026-10-09T12:00:00.000Z',
        updatedAt: '2026-10-09T12:00:00.000Z',
      },
    ]

    async function renderWithNotes() {
      const { useQuery } = await import('convex/react')
      vi.mocked(useQuery).mockImplementation(
        ((query: unknown) => {
          const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
          if (name === 'candidates:getCandidateDetail') return createDetailResponse()
          if (name === 'candidates:listCandidateTasksForHR') return []
          if (name === 'candidates:listCandidateNotes') return existingNotes
          if (name === 'files:getDownloadUrl') return 'https://example.com/download/storage-1'
          return undefined
        }) as unknown as typeof useQuery,
      )

      render(
        <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
          <Routes>
            <Route
              path='/hr/candidates/:candidateId'
              element={<ApplicationReviewPage />}
            />
          </Routes>
        </MemoryRouter>,
      )

      return waitFor(() => screen.getByTestId('candidate-notes'))
    }

    it('lists existing notes with author and text', async () => {
      const section = await renderWithNotes()

      expect(within(section).getByText('Strong applicant, fast-track.')).toBeInTheDocument()
      expect(within(section).getByText('Called 10/10 — pending docs.')).toBeInTheDocument()
      expect(within(section).getAllByText(/HR Person ·/).length).toBe(2)
    })

    it('creates a note only via the Save note button (no autosave)', async () => {
      const user = userEvent.setup()
      const section = await renderWithNotes()

      const input = within(section).getByTestId('new-note-input')
      const saveButton = within(section).getByTestId('save-note-button')
      expect(saveButton).toBeDisabled()

      await user.type(input, '  Needs updated CPR card.  ')
      expect(saveButton).not.toBeDisabled()
      expect(addCandidateNoteMock).not.toHaveBeenCalled()

      await user.click(saveButton)
      await waitFor(() => {
        expect(addCandidateNoteMock).toHaveBeenCalledWith({
          clerkOrgId: 'org_123',
          candidateId: 'cand_1',
          text: '  Needs updated CPR card.  ',
        })
      })
    })

    it('edits a note inline', async () => {
      const user = userEvent.setup()
      await renderWithNotes()

      await user.click(screen.getByTestId('edit-note-note_1'))
      const editInput = screen.getByTestId('edit-note-input')
      await user.clear(editInput)
      await user.type(editInput, 'Updated text')
      await user.click(screen.getByTestId('save-edited-note-button'))

      await waitFor(() => {
        expect(updateCandidateNoteMock).toHaveBeenCalledWith({
          clerkOrgId: 'org_123',
          noteId: 'note_1',
          text: 'Updated text',
        })
      })
    })

    it('deletes a note after confirmation', async () => {
      const user = userEvent.setup()
      await renderWithNotes()

      await user.click(screen.getByTestId('delete-note-note_1'))
      const dialog = await screen.findByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => {
        expect(deleteCandidateNoteMock).toHaveBeenCalledWith({
          clerkOrgId: 'org_123',
          noteId: 'note_1',
        })
      })
    })
  })

  describe('request correction dialog', () => {
    it('requires a reason and passes it as hrNotes', async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
          <Routes>
            <Route
              path='/hr/candidates/:candidateId'
              element={<ApplicationReviewPage />}
            />
          </Routes>
        </MemoryRouter>,
      )

      const correctionButton = await waitFor(() =>
        screen.getByTestId('request-correction-button'),
      )
      await user.click(correctionButton)

      const dialog = await screen.findByRole('dialog')
      const confirmButton = within(dialog).getByTestId('confirm-correction-button')
      expect(confirmButton).toBeDisabled()
      expect(reviewApplicationMock).not.toHaveBeenCalled()

      await user.type(
        within(dialog).getByTestId('correction-reason-input'),
        'SSN does not match the I-9',
      )
      expect(confirmButton).not.toBeDisabled()
      await user.click(confirmButton)

      await waitFor(() => {
        expect(reviewApplicationMock).toHaveBeenCalledWith({
          clerkOrgId: 'org_123',
          candidateId: 'cand_1',
          decision: 'needs_correction',
          hrNotes: 'SSN does not match the I-9',
        })
      })
    })
  })

  describe('car insurance section', () => {
    function datePlusDays(days: number) {
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }

    async function renderWithCarInsurance(options: {
      canTransportClients?: boolean
      expiresAt?: string
    }) {
      const { useQuery } = await import('convex/react')
      const documents: Array<{
        _id: string
        category: string
        status: string
        fileName: string
        storageId: string
        expiresAt: string
      }> = []
      if (options.expiresAt) {
        documents.push({
          _id: 'doc_car',
          category: 'car_insurance',
          status: 'active',
          fileName: 'policy.pdf',
          storageId: 'storage-car',
          expiresAt: options.expiresAt,
        })
      }
      vi.mocked(useQuery).mockImplementation(
        ((query: unknown) => {
          const name = getFunctionName(query as Parameters<typeof getFunctionName>[0])
          if (name === 'candidates:getCandidateDetail') {
            return createDetailResponse({
              fields: {
                personal: {
                  firstName: 'Jane',
                  lastName: 'Doe',
                  canTransportClients: options.canTransportClients,
                },
              },
              documents,
            })
          }
          if (name === 'candidates:listCandidateTasksForHR') return []
          if (name === 'files:getDownloadUrl') return 'https://example.com/download/storage-car'
          return undefined
        }) as unknown as typeof useQuery,
      )

      render(
        <MemoryRouter initialEntries={['/hr/candidates/cand_1']}>
          <Routes>
            <Route
              path='/hr/candidates/:candidateId'
              element={<ApplicationReviewPage />}
            />
          </Routes>
        </MemoryRouter>,
      )

      return waitFor(() => screen.getByTestId('car-insurance-section'))
    }

    it('shows a Missing badge when transport is desired but no policy is uploaded', async () => {
      const section = await renderWithCarInsurance({ canTransportClients: true })

      expect(within(section).getByText('Yes')).toBeInTheDocument()
      expect(within(section).getByText('Not uploaded')).toBeInTheDocument()
      expect(within(section).getByText('Missing')).toBeInTheDocument()
    })

    it('shows an Expiring soon badge when the policy expires within 30 days', async () => {
      const section = await renderWithCarInsurance({
        canTransportClients: true,
        expiresAt: datePlusDays(10),
      })

      expect(within(section).getByText('Uploaded')).toBeInTheDocument()
      expect(within(section).getByText('Expiring soon')).toBeInTheDocument()
    })

    it('shows an Expired badge when the policy expiry date has passed', async () => {
      const section = await renderWithCarInsurance({
        canTransportClients: true,
        expiresAt: datePlusDays(-5),
      })

      expect(within(section).getByText('Expired')).toBeInTheDocument()
    })

    it('shows a Valid badge when the policy expires beyond 30 days', async () => {
      const section = await renderWithCarInsurance({
        canTransportClients: true,
        expiresAt: datePlusDays(90),
      })

      expect(within(section).getByText('Valid')).toBeInTheDocument()
    })

    it('shows Not applicable when the applicant does not transport clients', async () => {
      const section = await renderWithCarInsurance({ canTransportClients: false })

      expect(within(section).getByText('No')).toBeInTheDocument()
      expect(within(section).getByText('Not applicable')).toBeInTheDocument()
    })
  })
})
