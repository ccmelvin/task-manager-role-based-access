import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders task manager heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/task manager/i);
  expect(headingElement).toBeInTheDocument();
});

test('renders without crashing', () => {
  render(<App />);
});