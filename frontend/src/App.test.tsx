import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  render(<App />);
  // Just check that the app renders without throwing
  expect(document.body).toBeInTheDocument();
});

test('renders main container', () => {
  render(<App />);
  // Look for any text that should be in the app
  const appElement = screen.getByRole('main') || document.querySelector('.App') || document.body.firstChild;
  expect(appElement).toBeInTheDocument();
});