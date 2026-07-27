import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtriaLogo } from './AtriaLogo'

describe('AtriaLogo', () => {
  it('renders the horizontal logo image', () => {
    render(<AtriaLogo />)

    expect(screen.getByAltText('ATRIA-X')).toHaveAttribute('src', '/atria-logo-horizontal.png')
  })

  it('shows the powered-by caption by default', () => {
    render(<AtriaLogo />)

    expect(screen.getByText('Powered by ATRIA-X Digital Solutions')).toBeInTheDocument()
  })

  it('hides the caption when hideCaption is set', () => {
    render(<AtriaLogo hideCaption />)

    expect(screen.queryByText('Powered by ATRIA-X Digital Solutions')).not.toBeInTheDocument()
  })

  it('applies a custom className to the image', () => {
    render(<AtriaLogo className='h-8' />)

    expect(screen.getByAltText('ATRIA-X')).toHaveClass('h-8')
  })
})
