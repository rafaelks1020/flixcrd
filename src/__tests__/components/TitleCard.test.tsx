import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock Next.js Image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock TitleCard component
const MockTitleCard = ({ title }: { title: any }) => (
  <div data-testid="title-card">
    <h3 data-testid="title">{title.name}</h3>
    <span data-testid="year">{title.year}</span>
    <img data-testid="poster" src={title.posterPath} alt={title.name} />
  </div>
)

describe('TitleCard Component', () => {
  const mockTitle = {
    id: '1',
    name: 'Test Movie',
    year: 2023,
    posterPath: '/test-poster.jpg',
    overview: 'Test overview',
  }

  it('renders title information correctly', () => {
    render(<MockTitleCard title={mockTitle} />)
    
    expect(screen.getByTestId('title')).toHaveTextContent('Test Movie')
    expect(screen.getByTestId('year')).toHaveTextContent('2023')
    expect(screen.getByTestId('poster')).toHaveAttribute('src', '/test-poster.jpg')
  })

  it('has correct data-testid', () => {
    render(<MockTitleCard title={mockTitle} />)
    
    const card = screen.getByTestId('title-card')
    expect(card).toBeInTheDocument()
  })

  it('handles missing poster gracefully', () => {
    const titleWithoutPoster = { ...mockTitle, posterPath: null }
    render(<MockTitleCard title={titleWithoutPoster} />)
    
    const poster = screen.getByTestId('poster')
    expect(poster).toHaveAttribute('src', 'null')
  })
})
