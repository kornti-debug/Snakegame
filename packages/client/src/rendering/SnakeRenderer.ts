import type { SnakeState, Vector2D } from '@snakegame/shared';

export function drawSnake(ctx: CanvasRenderingContext2D, snake: SnakeState): void {
  const segments = snake.segments;
  if (segments.length < 2) return;

  // Draw body as smooth curve
  ctx.strokeStyle = snake.color;
  ctx.lineWidth = snake.radius * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = snake.alive ? 1 : 0.3;

  ctx.beginPath();
  ctx.moveTo(segments[0].x, segments[0].y);

  // Use quadratic curves through midpoints for smooth path
  for (let i = 1; i < segments.length - 1; i++) {
    const midX = (segments[i].x + segments[i + 1].x) / 2;
    const midY = (segments[i].y + segments[i + 1].y) / 2;
    ctx.quadraticCurveTo(segments[i].x, segments[i].y, midX, midY);
  }

  // Last segment
  const last = segments[segments.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  // Draw head
  drawHead(ctx, snake);

  ctx.globalAlpha = 1;
}

function drawHead(ctx: CanvasRenderingContext2D, snake: SnakeState): void {
  const head = snake.segments[0];
  const r = snake.radius * 1.4;

  // Head circle
  ctx.fillStyle = snake.color;
  ctx.beginPath();
  ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeOffset = r * 0.5;
  const eyeR = r * 0.3;
  const perpAngle = snake.angle + Math.PI / 2;

  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(snake.angle) * eyeOffset * 0.5 +
               Math.cos(perpAngle) * eyeOffset * side;
    const ey = head.y + Math.sin(snake.angle) * eyeOffset * 0.5 +
               Math.sin(perpAngle) * eyeOffset * side;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(
      ex + Math.cos(snake.angle) * eyeR * 0.3,
      ey + Math.sin(snake.angle) * eyeR * 0.3,
      eyeR * 0.5, 0, Math.PI * 2
    );
    ctx.fill();
  }
}
