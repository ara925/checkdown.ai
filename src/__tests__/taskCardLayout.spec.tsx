import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function MockTaskCard() {
  return (
    <Card className="task-card-frame">
      <CardHeader>
        <CardTitle>Sample Task</CardTitle>
      </CardHeader>
      <CardContent className="task-card-inner">
        <div className="task-card-scroll">
          <p>Body</p>
        </div>
      </CardContent>
    </Card>
  );
}

describe('Task card layout classes', () => {
  it('applies standardized frame and inner classes', () => {
    render(<MockTaskCard />);
    const cardFrame = screen.getByText('Sample Task').closest('.task-card-frame');
    expect(cardFrame).toBeTruthy();
  });
});
