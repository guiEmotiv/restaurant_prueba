// Simple unit test for basic components
import { render } from '@testing-library/react';
import Button from '../components/common/Button';

describe('Button Component', () => {
  test('renders button with text', () => {
    const { getByText } = render(<Button>Test Button</Button>);
    expect(getByText('Test Button')).toBeInTheDocument();
  });

  test('applies primary variant class', () => {
    const { getByText } = render(<Button variant="primary">Primary Button</Button>);
    const button = getByText('Primary Button');
    expect(button).toHaveClass('bg-blue-600');
  });
});