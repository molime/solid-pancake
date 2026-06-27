import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamPage } from './TeamPage'

const mocks = {
  createInvitation: vi.fn(),
  createCaregiver: vi.fn(),
  runAdpInitialWorkerLoad: vi.fn(),
  drainAdpPendingRows: vi.fn(),
  updateMember: vi.fn(),
  updateRole: vi.fn(),
  getInvitations: vi.fn(),
  revoke: vi.fn(),
}

vi.mock('@clerk/react', async () => {
  const actual =
    await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return {
    ...actual,
    useOrganization: vi.fn(),
    useUser: vi.fn(),
  }
})

vi.mock('convex/react', async () => {
  const actual =
    await vi.importActual<typeof import('convex/react')>('convex/react')
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useAction: vi.fn(),
  }
})

import { useOrganization, useUser } from '@clerk/react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { getFunctionName } from 'convex/server'

function mockTeamState(options: {
  members?: Array<{
    _id: string
    clerkUserId: string
    displayName: string
    email: string
    role: string
  }>
  employeeProfiles?: Array<{
    _id: string
    displayName: string
    email: string
    role: string
    adpSyncStatus: string
  }>
  currentUserId?: string
  invitations?: Array<{
    id: string
    emailAddress: string
    role: string
    roleName: string
    status: 'pending' | 'accepted' | 'revoked' | 'expired'
    createdAt: Date
    revoke?: () => Promise<unknown>
  }>
}) {
  const members = options.members ?? []
  const employeeProfiles = options.employeeProfiles
  const currentUserId = options.currentUserId ?? 'user_admin'
  const invitations = options.invitations ?? []

  vi.mocked(useOrganization).mockReturnValue({
    isLoaded: true,
    organization: {
      id: 'org_123',
      updateMember: mocks.updateMember,
      getInvitations: mocks.getInvitations.mockResolvedValue({
        data: invitations,
      }),
    },
  } as unknown as ReturnType<typeof useOrganization>)

  vi.mocked(useUser).mockReturnValue({
    user: { id: currentUserId },
  } as unknown as ReturnType<typeof useUser>)

  vi.mocked(useQuery).mockImplementation(
    ((queryRef: unknown) => {
      const name = getFunctionName(queryRef as Parameters<typeof getFunctionName>[0])
      if (name === 'members:list') return members
      if (name === 'employeeProfiles:listEmployeeProfiles') return employeeProfiles
      return undefined
    }) as unknown as typeof useQuery,
  )

  vi.mocked(useMutation).mockImplementation(
    ((mutationRef: unknown) => {
      const name = getFunctionName(mutationRef as Parameters<typeof getFunctionName>[0])
      if (name === 'members:updateRole') return mocks.updateRole
      if (name === 'employeeProfiles:drainAdpPendingRows')
        return mocks.drainAdpPendingRows
      return vi.fn()
    }) as unknown as typeof useMutation,
  )

  vi.mocked(useAction).mockImplementation(
    ((actionRef: unknown) => {
      const name = getFunctionName(actionRef as Parameters<typeof getFunctionName>[0])
      if (name === 'employeeProfiles:createCaregiver') return mocks.createCaregiver
      if (name === 'employeeProfiles:runAdpInitialWorkerLoad')
        return mocks.runAdpInitialWorkerLoad
      return mocks.createInvitation
    }) as unknown as typeof useAction,
  )
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates caregiver invitations through the server redirect flow', async () => {
    mocks.createInvitation.mockResolvedValueOnce({
      id: 'inv_1',
      emailAddress: 'caregiver@agency.com',
      role: 'org:member',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const emailInput = screen.getByPlaceholderText('colleague@agency.com')
    const roleSelect = screen.getByDisplayValue('Caregiver')
    const sendButton = screen.getByRole('button', { name: /Send invite/i })

    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'caregiver@agency.com')
    await userEvent.selectOptions(roleSelect, 'org:caregiver')
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(mocks.createInvitation).toHaveBeenCalledTimes(1)
    })
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      emailAddress: 'caregiver@agency.com',
      role: 'org:caregiver',
      appBaseUrl: window.location.origin,
    })
  })

  it('passes coordinator intent to the server invitation flow', async () => {
    mocks.createInvitation.mockResolvedValueOnce({
      id: 'inv_2',
      emailAddress: 'coordinator@agency.com',
      role: 'org:member',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const emailInput = screen.getByPlaceholderText('colleague@agency.com')
    const roleSelect = screen.getByDisplayValue('Caregiver')
    const sendButton = screen.getByRole('button', { name: /Send invite/i })

    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'coordinator@agency.com')
    await userEvent.selectOptions(roleSelect, 'org:coordinator')
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(mocks.createInvitation).toHaveBeenCalledTimes(1)
    })
    expect(mocks.createInvitation).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      emailAddress: 'coordinator@agency.com',
      role: 'org:coordinator',
      appBaseUrl: window.location.origin,
    })
  })

  it('maps coordinator role to org:member when updating Clerk membership', async () => {
    mocks.updateMember.mockResolvedValueOnce({})
    mocks.updateRole.mockResolvedValueOnce({})

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
        {
          _id: 'm2',
          clerkUserId: 'user_caregiver',
          displayName: 'Caregiver User',
          email: 'caregiver@test.com',
          role: 'org:caregiver',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const caregiverRow = screen.getByText('Caregiver User').closest('tr')
    const roleSelect = caregiverRow!.querySelector('select')!

    await userEvent.selectOptions(roleSelect, 'org:coordinator')

    await waitFor(() => {
      expect(mocks.updateMember).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateMember).toHaveBeenCalledWith({
      userId: 'user_caregiver',
      role: 'org:member',
    })
    await waitFor(() => {
      expect(mocks.updateRole).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateRole).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      clerkUserId: 'user_caregiver',
      role: 'org:coordinator',
    })
  })

  it('preserves org:admin when updating Clerk membership to admin', async () => {
    mocks.updateMember.mockResolvedValueOnce({})
    mocks.updateRole.mockResolvedValueOnce({})

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
        {
          _id: 'm2',
          clerkUserId: 'user_caregiver',
          displayName: 'Caregiver User',
          email: 'caregiver@test.com',
          role: 'org:caregiver',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const caregiverRow = screen.getByText('Caregiver User').closest('tr')
    const roleSelect = caregiverRow!.querySelector('select')!

    await userEvent.selectOptions(roleSelect, 'org:admin')

    await waitFor(() => {
      expect(mocks.updateMember).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateMember).toHaveBeenCalledWith({
      userId: 'user_caregiver',
      role: 'org:admin',
    })
    await waitFor(() => {
      expect(mocks.updateRole).toHaveBeenCalledTimes(1)
    })
    expect(mocks.updateRole).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      clerkUserId: 'user_caregiver',
      role: 'org:admin',
    })
  })

  it('renders pending invitations fetched from Clerk', async () => {
    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
      invitations: [
        {
          id: 'inv_1',
          emailAddress: 'pending@agency.com',
          role: 'org:member',
          roleName: 'Member',
          status: 'pending',
          createdAt: new Date(),
          revoke: mocks.revoke,
        },
      ],
    })

    render(<TeamPage />)

    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
    })
    expect(screen.getByText('pending@agency.com')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows a revoke button for pending invitations', async () => {
    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
      invitations: [
        {
          id: 'inv_1',
          emailAddress: 'pending@agency.com',
          role: 'org:member',
          roleName: 'Member',
          status: 'pending',
          createdAt: new Date(),
          revoke: mocks.revoke,
        },
      ],
    })

    render(<TeamPage />)

    await waitFor(() => {
      expect(screen.getByText('Pending Invitations')).toBeInTheDocument()
    })
    const revokeButton = screen.getByRole('button', { name: /Revoke/i })
    expect(revokeButton).toBeInTheDocument()
  })

  it('refreshes invitations list after sending an invite', async () => {
    mocks.createInvitation.mockResolvedValueOnce({
      id: 'inv_3',
      emailAddress: 'new@agency.com',
      role: 'org:member',
      status: 'pending',
      createdAt: new Date().toISOString(),
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const emailInput = screen.getByPlaceholderText('colleague@agency.com')
    const sendButton = screen.getByRole('button', { name: /Send invite/i })

    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'new@agency.com')
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(mocks.createInvitation).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(mocks.getInvitations).toHaveBeenCalledTimes(2)
    })
  })

  it('shows "already a member" message when invitee is already in the org', async () => {
    mocks.createInvitation.mockResolvedValueOnce({
      id: 'inv_4',
      emailAddress: 'existing@agency.com',
      role: 'org:member',
      status: 'accepted',
      createdAt: new Date().toISOString(),
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const emailInput = screen.getByPlaceholderText('colleague@agency.com')
    const sendButton = screen.getByRole('button', { name: /Send invite/i })

    await userEvent.clear(emailInput)
    await userEvent.type(emailInput, 'existing@agency.com')
    await userEvent.click(sendButton)

    await waitFor(() => {
      expect(
        screen.getByText(/existing@agency.com joined the organization/i),
      ).toBeInTheDocument()
    })
  })

  it('adds a caregiver through the caregiver form', async () => {
    mocks.createCaregiver.mockResolvedValueOnce({
      profileId: 'profile_1',
      invitationId: 'inv_cg',
      emailAddress: 'newcaregiver@agency.com',
      role: 'org:member',
      status: 'pending',
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      employeeProfiles: [],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const nameInput = screen.getByPlaceholderText('Caregiver name')
    const emailInput = screen.getByPlaceholderText('caregiver@agency.com')
    const addButton = screen.getByRole('button', { name: /Add caregiver/i })

    await userEvent.type(nameInput, 'New Caregiver')
    await userEvent.type(emailInput, 'newcaregiver@agency.com')
    await userEvent.click(addButton)

    await waitFor(() => {
      expect(mocks.createCaregiver).toHaveBeenCalledTimes(1)
    })
    expect(mocks.createCaregiver).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
      displayName: 'New Caregiver',
      email: 'newcaregiver@agency.com',
      appBaseUrl: window.location.origin,
    })
  })

  it('loads ADP workers and shows a summary toast', async () => {
    mocks.runAdpInitialWorkerLoad.mockResolvedValueOnce({
      status: 'success',
      processed: 3,
      matched: 1,
      created: 2,
      errors: 0,
    })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      employeeProfiles: [],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const loadButton = screen.getByRole('button', { name: /Load from ADP/i })
    await userEvent.click(loadButton)

    await waitFor(() => {
      expect(mocks.runAdpInitialWorkerLoad).toHaveBeenCalledTimes(1)
    })
    expect(mocks.runAdpInitialWorkerLoad).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
    })
    await waitFor(() => {
      expect(
        screen.getByText(/3 processed, 1 matched, 2 created, 0 errors/i),
      ).toBeInTheDocument()
    })
  })

  it('queues an ADP drain for pending rows', async () => {
    mocks.drainAdpPendingRows.mockResolvedValueOnce({ status: 'queued' })

    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      employeeProfiles: [],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    const drainButton = screen.getByRole('button', { name: /Drain ADP queue/i })
    await userEvent.click(drainButton)

    await waitFor(() => {
      expect(mocks.drainAdpPendingRows).toHaveBeenCalledTimes(1)
    })
    expect(mocks.drainAdpPendingRows).toHaveBeenCalledWith({
      clerkOrgId: 'org_123',
    })
    await waitFor(() => {
      expect(
        screen.getByText(/ADP drain queued/i),
      ).toBeInTheDocument()
    })
  })

  it('renders employee profiles with ADP sync status pills', async () => {
    mockTeamState({
      members: [
        {
          _id: 'm1',
          clerkUserId: 'user_admin',
          displayName: 'Admin User',
          email: 'admin@test.com',
          role: 'org:admin',
        },
      ],
      employeeProfiles: [
        {
          _id: 'p1',
          displayName: 'Synced Caregiver',
          email: 'synced@agency.com',
          role: 'org:caregiver',
          adpSyncStatus: 'synced',
        },
        {
          _id: 'p2',
          displayName: 'Queued Caregiver',
          email: 'queued@agency.com',
          role: 'org:caregiver',
          adpSyncStatus: 'queued',
        },
      ],
      currentUserId: 'user_admin',
    })

    render(<TeamPage />)

    await waitFor(() => {
      expect(screen.getByText('Synced Caregiver')).toBeInTheDocument()
      expect(screen.getByText('Queued Caregiver')).toBeInTheDocument()
      expect(screen.getByText('Synced')).toBeInTheDocument()
      expect(screen.getByText('Queued')).toBeInTheDocument()
    })
  })
})
