import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AtriaLogo } from './AtriaLogo'

describe('AtriaLogo', () => {
  it('renders the horizontal logo image', () => {
    render(<AtriaLogo />)

    expect(screen.getByAltText('ATRIA-X')).toHaveAttribute('src', '/atria-logo-horizontal.png')
  })

  it('renders at the default h-28 height', () => {
    render(<AtriaLogo />)

    expect(screen.getByAltText('ATRIA-X')).toHaveClass('h-28')
  })

  it('applies a custom className to the image', () => {
    render(<AtriaLogo className='h-8' />)

    expect(screen.getByAltText('ATRIA-X')).toHaveClass('h-8')
  })
})
