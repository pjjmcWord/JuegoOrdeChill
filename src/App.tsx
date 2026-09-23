import { useEffect, useRef, useState, useCallback } from 'react';

interface Entity {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'circle' | 'square' | 'triangle';
  hp: number;
  speed: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const gameRef = useRef({
    player: { x: 0, y: 0, size: 16, speed: 4 },
    enemies: [] as Entity[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    keys: {} as Record<string, boolean>,
    mouse: { x: 0, y: 0, down: false },
    score: 0,
    time: 0,
    spawnTimer: 0,
    shootTimer: 0,
    animFrame: 0,
    lastTime: 0,
  });

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = gameRef.current;
    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.enemies = [];
    game.bullets = [];
    game.particles = [];
    game.score = 0;
    game.time = 0;
    game.spawnTimer = 0;
    game.shootTimer = 0;
    setScore(0);
    setGameState('playing');
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleKeyDown = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameRef.current.keys[e.key.toLowerCase()] = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
      gameRef.current.mouse.x = e.clientX;
      gameRef.current.mouse.y = e.clientY;
    };
    const handleMouseDown = () => {
      gameRef.current.mouse.down = true;
    };
    const handleMouseUp = () => {
      gameRef.current.mouse.down = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);

    const spawnEnemy = () => {
      const game = gameRef.current;
      const types: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      // Spawn from edges
      const side = Math.floor(Math.random() * 4);
      let x = 0, y = 0;
      const margin = 50;
      
      switch (side) {
        case 0: x = Math.random() * canvas.width; y = -margin; break;
        case 1: x = canvas.width + margin; y = Math.random() * canvas.height; break;
        case 2: x = Math.random() * canvas.width; y = canvas.height + margin; break;
        case 3: x = -margin; y = Math.random() * canvas.height; break;
      }

      const difficultyMult = 1 + game.time / 30;
      const baseSpeed = 1 + Math.random() * 0.5;
      const size = type === 'square' ? 14 : type === 'triangle' ? 16 : 12;
      const hp = type === 'square' ? 2 : type === 'triangle' ? 3 : 1;

      game.enemies.push({
        x, y, vx: 0, vy: 0,
        size,
        type,
        hp: Math.ceil(hp * (1 + game.time / 60)),
        speed: baseSpeed * Math.min(difficultyMult, 3),
      });
    };

    const createParticles = (x: number, y: number, count: number, color: string) => {
      const game = gameRef.current;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        game.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 30 + Math.random() * 20,
          maxLife: 50,
          size: 2 + Math.random() * 3,
        });
      }
    };

    const drawTriangle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.866, y + size * 0.5);
      ctx.lineTo(x + size * 0.866, y + size * 0.5);
      ctx.closePath();
    };

    const gameLoop = (timestamp: number) => {
      const game = gameRef.current;
      
      if (!game.lastTime) game.lastTime = timestamp;
      const delta = Math.min((timestamp - game.lastTime) / 16.67, 3);
      game.lastTime = timestamp;

      ctx.fillStyle = '#f5f5f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (gameState === 'playing') {
        game.time += delta / 60;

        // Player movement
        const speed = game.player.speed * delta;
        if (game.keys['w'] || game.keys['arrowup']) game.player.y -= speed;
        if (game.keys['s'] || game.keys['arrowdown']) game.player.y += speed;
        if (game.keys['a'] || game.keys['arrowleft']) game.player.x -= speed;
        if (game.keys['d'] || game.keys['arrowright']) game.player.x += speed;

        // Clamp player position
        game.player.x = Math.max(game.player.size, Math.min(canvas.width - game.player.size, game.player.x));
        game.player.y = Math.max(game.player.size, Math.min(canvas.height - game.player.size, game.player.y));

        // Shooting
        if (game.mouse.down) {
          game.shootTimer += delta;
          if (game.shootTimer >= 6) {
            game.shootTimer = 0;
            const angle = Math.atan2(
              game.mouse.y - game.player.y,
              game.mouse.x - game.player.x
            );
            game.bullets.push({
              x: game.player.x + Math.cos(angle) * game.player.size,
              y: game.player.y + Math.sin(angle) * game.player.size,
              vx: Math.cos(angle) * 10,
              vy: Math.sin(angle) * 10,
              size: 4,
            });
          }
        }

        // Spawn enemies
        const spawnRate = Math.max(10, 60 - game.time * 2);
        game.spawnTimer += delta;
        if (game.spawnTimer >= spawnRate) {
          game.spawnTimer = 0;
          const numToSpawn = Math.min(1 + Math.floor(game.time / 20), 4);
          for (let i = 0; i < numToSpawn; i++) {
            spawnEnemy();
          }
        }

        // Update bullets
        game.bullets = game.bullets.filter(b => {
          b.x += b.vx * delta;
          b.y += b.vy * delta;
          return b.x > -50 && b.x < canvas.width + 50 && b.y > -50 && b.y < canvas.height + 50;
        });

        // Update enemies
        game.enemies.forEach(e => {
          const dx = game.player.x - e.x;
          const dy = game.player.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            e.vx = (dx / dist) * e.speed;
            e.vy = (dy / dist) * e.speed;
          }
          e.x += e.vx * delta;
          e.y += e.vy * delta;
        });

        // Bullet-enemy collisions
        game.bullets = game.bullets.filter(b => {
          let hit = false;
          game.enemies = game.enemies.filter(e => {
            const dx = b.x - e.x;
            const dy = b.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < e.size + b.size) {
              hit = true;
              e.hp--;
              if (e.hp <= 0) {
                game.score += e.type === 'triangle' ? 3 : e.type === 'square' ? 2 : 1;
                setScore(game.score);
                createParticles(e.x, e.y, 8, '#333');
                return false;
              }
            }
            return true;
          });
          return !hit;
        });

        // Player-enemy collision
        game.enemies.forEach(e => {
          const dx = game.player.x - e.x;
          const dy = game.player.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < game.player.size + e.size - 4) {
            setGameState('gameover');
            setHighScore(prev => Math.max(prev, game.score));
            createParticles(game.player.x, game.player.y, 20, '#000');
          }
        });

        // Update particles
        game.particles = game.particles.filter(p => {
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.life -= delta;
          return p.life > 0;
        });
      }

      // Draw particles
      game.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = `rgba(50, 50, 50, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw bullets
      ctx.fillStyle = '#333';
      game.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw enemies
      game.enemies.forEach(e => {
        ctx.fillStyle = e.type === 'circle' ? '#e74c3c' : e.type === 'square' ? '#e67e22' : '#9b59b6';
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1.5;
        
        if (e.type === 'circle') {
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (e.type === 'square') {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(Math.atan2(game.player.y - e.y, game.player.x - e.x));
          ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
          ctx.strokeRect(-e.size, -e.size, e.size * 2, e.size * 2);
          ctx.restore();
        } else {
          const angle = Math.atan2(game.player.y - e.y, game.player.x - e.x) - Math.PI / 2;
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(angle);
          drawTriangle(ctx, 0, 0, e.size);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });

      // Draw player
      if (gameState === 'playing') {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(game.player.x, game.player.y, game.player.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Player outline
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Aim line
        if (game.mouse.down) {
          const angle = Math.atan2(game.mouse.y - game.player.y, game.mouse.x - game.player.x);
          ctx.strokeStyle = 'rgba(0,0,0,0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(game.player.x + Math.cos(angle) * game.player.size, game.player.y + Math.sin(angle) * game.player.size);
          ctx.lineTo(game.player.x + Math.cos(angle) * 60, game.player.y + Math.sin(angle) * 60);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw grid (subtle)
      ctx.strokeStyle = 'rgba(0,0,0,0.03)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      game.animFrame = requestAnimationFrame(gameLoop);
    };

    gameRef.current.animFrame = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(gameRef.current.animFrame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState]);

  return (
    <div className="w-full h-screen overflow-hidden relative" style={{ background: '#f5f5f0' }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: gameState === 'playing' ? 'crosshair' : 'default' }}
      />
      
      {/* HUD */}
      {gameState === 'playing' && (
        <div className="absolute top-6 left-6 font-mono text-sm" style={{ color: '#333' }}>
          <div className="text-2xl font-bold tracking-tight">{score}</div>
          <div className="text-xs opacity-50 mt-1">
            TIME: {Math.floor(gameRef.current.time)}s
          </div>
        </div>
      )}

      {/* Menu */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tighter mb-2" style={{ color: '#1a1a1a' }}>
              SURVIVAL
            </h1>
            <p className="text-sm opacity-40 mb-12 font-mono tracking-wide" style={{ color: '#333' }}>
              A minimalist shooter
            </p>
            
            <button
              onClick={startGame}
              className="px-8 py-3 text-sm font-mono tracking-wider border-2 transition-all duration-200 hover:scale-105"
              style={{ 
                color: '#1a1a1a', 
                borderColor: '#1a1a1a',
                background: 'transparent',
              }}
            >
              START
            </button>

            <div className="mt-16 text-xs font-mono opacity-30 space-y-2" style={{ color: '#333' }}>
              <p>WASD — move</p>
              <p>HOLD CLICK — shoot</p>
              <p>SURVIVE</p>
            </div>
          </div>
        </div>
      )}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'rgba(245, 245, 240, 0.9)' }}>
          <div className="text-center">
            <h2 className="text-4xl font-bold tracking-tighter mb-4" style={{ color: '#1a1a1a' }}>
              GAME OVER
            </h2>
            <div className="font-mono text-lg mb-2" style={{ color: '#333' }}>
              SCORE: <span className="font-bold">{score}</span>
            </div>
            {highScore > 0 && (
              <div className="font-mono text-xs opacity-40 mb-8" style={{ color: '#333' }}>
                BEST: {highScore}
              </div>
            )}
            
            <button
              onClick={startGame}
              className="px-8 py-3 text-sm font-mono tracking-wider border-2 transition-all duration-200 hover:scale-105"
              style={{ 
                color: '#1a1a1a', 
                borderColor: '#1a1a1a',
                background: 'transparent',
              }}
            >
              RETRY
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
