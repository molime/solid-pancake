import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'
import { Input } from './Input'
import { Select } from './Select'
import { Textarea } from './Textarea'
import { FieldGroup } from './FieldGroup'
import { StatusBadge } from './StatusBadge'
import { KpiCard } from './KpiCard'
import { ProgressSteps } from './ProgressSteps'
import { EmptyState } from './EmptyState'
import { Toast } from './Toast'
import { Badge } from './Badge'
import { AgencyBranding } from './AgencyBranding'
import { useTenant } from '@/app/useTenant'

vi.mock('@/app/useTenant', () => ({
  useTenant: vi.fn(),
}))

describe('shared UI primitives', () => {
  describe('Button', () => {
    it('renders a default secondary button', () => {
      render(<Button>Click</Button>)
      const button = screen.getByRole('button', { name: 'Click' })
      expect(button).toBeInTheDocument()
      expect(button.className).toContain('bg-atria-surface')
    })

    it('supports primary variant and large size', () => {
      render(
        <Button variant="primary" size="lg">
          Submit
        </Button>,
      )
      const button = screen.getByRole('button', { name: 'Submit' })
      expect(button.className).toContain('bg-atria-accent')
      expect(button.className).toContain('h-[52px]')
    })

    it('keeps type="button" default and can be disabled', () => {
      render(<Button disabled>Blocked</Button>)
      const button = screen.getByRole('button', { name: 'Blocked' })
      expect(button).toHaveAttribute('type', 'button')
      expect(button).toBeDisabled()
    })
  })

  describe('Input', () => {
    it('renders with the dark control recipe', () => {
      render(<Input placeholder="Type here" />)
      const input = screen.getByPlaceholderText('Type here')
      expect(input.className).toContain('bg-atria-surface-3')
      expect(input.className).toContain('text-base')
    })

    it('supports large control size and error state', () => {
      render(<Input controlSize="lg" hasError data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input.className).toContain('h-[52px]')
      expect(input.className).toContain('border-atria-danger')
    })
  })

  describe('Select', () => {
    it('renders with the dark control recipe', () => {
      render(
        <Select>
          <option>One</option>
        </Select>,
      )
      const select = screen.getByRole('combobox')
      expect(select.className).toContain('bg-atria-surface-3')
      expect(select.className).toContain('text-base')
    })

    it('supports large control size and error state', () => {
      render(
        <Select controlSize="lg" hasError data-testid="select">
          <option>One</option>
        </Select>,
      )
      const select = screen.getByTestId('select')
      expect(select.className).toContain('h-[52px]')
      expect(select.className).toContain('border-atria-danger')
    })
  })

  describe('Textarea', () => {
    it('renders with the dark control recipe', () => {
      render(<Textarea placeholder="Notes" />)
      const textarea = screen.getByPlaceholderText('Notes')
      expect(textarea.className).toContain('bg-atria-surface-3')
      expect(textarea.className).toContain('text-base')
    })

    it('supports error state', () => {
      render(<Textarea hasError data-testid="textarea" />)
      const textarea = screen.getByTestId('textarea')
      expect(textarea.className).toContain('border-atria-danger')
    })
  })

  describe('FieldGroup', () => {
    it('renders label, helper text, and connects them to the child input', () => {
      render(
        <FieldGroup label="Email" htmlFor="email" helperText="We never share it.">
          <Input id="email" />
        </FieldGroup>,
      )
      expect(screen.getByText('Email')).toHaveAttribute('for', 'email')
      expect(screen.getByText('We never share it.')).toBeInTheDocument()
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'email-helper')
    })

    it('renders error text and marks the child input invalid', () => {
      render(
        <FieldGroup label="Email" htmlFor="email" error="Required">
          <Input id="email" />
        </FieldGroup>,
      )
      expect(screen.getByText('Required')).toBeInTheDocument()
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
    })
  })

  describe('StatusBadge', () => {
    it('renders a readable word label for every shift status', () => {
      const statuses = [
        'scheduled',
        'in_progress',
        'submitted',
        'needs_correction',
        'approved',
        'billing_ready',
      ] as const
      for (const status of statuses) {
        const { unmount } = render(<StatusBadge status={status} />)
        expect(screen.getByText(/[A-Za-z]/)).toBeInTheDocument()
        unmount()
      }
    })

    it('supports explicit semantic variants', () => {
      render(<StatusBadge variant="success">Done</StatusBadge>)
      expect(screen.getByText('Done')).toHaveClass('bg-atria-success-bg')
    })
  })

  describe('Badge', () => {
    it('supports a neutral variant', () => {
      render(<Badge variant="neutral">3</Badge>)
      expect(screen.getByText('3')).toHaveClass('bg-atria-neutral-bg')
    })
  })

  describe('KpiCard', () => {
    it('renders label, value, detail, and icon with dark tokens', () => {
      render(
        <KpiCard
          label="Total shifts"
          value="156"
          detail="12% from last week"
          icon={<span data-testid="icon">★</span>}
        />,
      )
      expect(screen.getByText('Total shifts')).toBeInTheDocument()
      expect(screen.getByText('156')).toBeInTheDocument()
      expect(screen.getByText('12% from last week')).toBeInTheDocument()
      expect(screen.getByTestId('icon')).toBeInTheDocument()
      const card = screen.getByText('156').parentElement
      expect(card?.className).toContain('bg-atria-surface')
      expect(card?.className).not.toContain('bg-white')
    })
  })

  describe('ProgressSteps', () => {
    it('marks the active step with aria-current and renders text labels', () => {
      const steps = [
        { id: 'when', label: 'When', description: 'Date and time' },
        { id: 'what', label: 'What' },
        { id: 'how', label: 'How' },
      ]
      render(<ProgressSteps steps={steps} currentStep={1} />)
      const active = screen.getByText('What').closest('li')
      expect(active).toHaveAttribute('aria-current', 'step')
      expect(screen.getByText('Date and time')).toBeInTheDocument()
      // Labels are hidden below the sm breakpoint to prevent overflow
      const labelContainer = screen.getByText('What').parentElement
      expect(labelContainer?.className).toContain('hidden')
      expect(labelContainer?.className).toContain('sm:block')
    })
  })

  describe('EmptyState', () => {
    it('renders visible text and calls the action callback', async () => {
      const onAction = vi.fn()
      render(
        <EmptyState
          title="No shifts yet"
          description="Create your first shift to get started."
          action={<Button onClick={onAction}>Create shift</Button>}
        />,
      )
      expect(screen.getByText('No shifts yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first shift to get started.')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Create shift' }))
      expect(onAction).toHaveBeenCalled()
    })
  })

  describe('Toast', () => {
    it('renders visible text and calls the close callback', async () => {
      const onClose = vi.fn()
      render(
        <Toast
          variant="success"
          title="Shift approved"
          description="The documentation is complete."
          onClose={onClose}
        />,
      )
      expect(screen.getByText('Shift approved')).toBeInTheDocument()
      expect(screen.getByText('The documentation is complete.')).toBeInTheDocument()
      await userEvent.click(screen.getByLabelText('Close notification'))
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('AgencyBranding', () => {
    it('renders the agency logo and powered-by text when a logo resolves', () => {
      vi.mocked(useTenant).mockReturnValue({
        tenantName: 'Individuals Choice Home Care',
      } as ReturnType<typeof useTenant>)
      render(<AgencyBranding />)
      expect(screen.getByAltText('Agency logo')).toHaveAttribute(
        'src',
        '/agency-logo-individualschoice.jpeg',
      )
      expect(
        screen.getByText('Powered by ATRIA-X Digital Solutions'),
      ).toBeInTheDocument()
    })

    it('renders only the powered-by text when no agency logo resolves', () => {
      vi.mocked(useTenant).mockReturnValue({
        tenantName: 'Some Other Agency',
      } as ReturnType<typeof useTenant>)
      render(<AgencyBranding />)
      expect(screen.queryByAltText('Agency logo')).not.toBeInTheDocument()
      expect(
        screen.getByText('Powered by ATRIA-X Digital Solutions'),
      ).toBeInTheDocument()
    })
  })
})
