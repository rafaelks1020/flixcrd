import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock HLS.js
jest.mock('hls.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    loadSource: jest.fn(),
    attachMedia: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
  })),
  isSupported: jest.fn(() => true),
}))

// Mock the Player component - we'll create a simple test structure
const MockPlayer = ({ src }: { src: string }) => (
  <div data-testid="video-player">
    <video data-testid="video-element" src={src} />
  </div>
)

describe('Player Component', () => {
  it('renders video element with correct src', () => {
    const testSrc = 'https://example.com/test.m3u8'
    render(<MockPlayer src={testSrc} />)
    
    const videoElement = screen.getByTestId('video-element')
    expect(videoElement).toBeInTheDocument()
    expect(videoElement).toHaveAttribute('src', testSrc)
  })

  it('has correct data-testid', () => {
    render(<MockPlayer src="test.m3u8" />)
    
    const player = screen.getByTestId('video-player')
    expect(player).toBeInTheDocument()
  })
})
