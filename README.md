# Tic-Tac-Toe

A modern, responsive, and animated Tic-Tac-Toe game built with HTML, CSS (custom + Bootstrap 5), and JavaScript. Playable in any browser and ready for instant deployment to Vercel or any static hosting service.

## Features
- Classic 3x3 Tic-Tac-Toe gameplay
- Play vs Computer (Easy, Medium, Hard difficulty levels)
- Play vs Friend (Local multiplayer)
- Online Multiplayer (Real-time with room codes)
- Responsive, mobile-friendly design
- Animated winner highlighting and confetti celebration
- Clean, efficient codebase

## Folder Structure
```
tic-tac-toe/
├── index.html
├── index.js
├── style.css
├── vercel.json
├── src/
│   ├── tic-tac-toe.js
│   ├── ai-player.js
│   ├── online-game.js
│   └── rl-agent.js
├── .gitignore
└── README.md
```

## How to Run Locally
1. Clone the repository or download the files
2. Open `index.html` in your browser, or use a local server:
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   ```
3. Navigate to `http://localhost:8000` in your browser
4. Play!

## How to Deploy to Vercel

### Option 1: Deploy via GitHub (Recommended)
1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and sign in with your GitHub account
3. Click "New Project" and import your repository
4. Vercel will auto-detect it as a static site
5. Click "Deploy" - no build settings needed!
6. Your site will be live in seconds

### Option 2: Deploy via Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. In your project directory, run:
   ```bash
   vercel
   ```
3. Follow the prompts to deploy

### Option 3: Automatic Deployments
Once connected to GitHub, Vercel will automatically deploy:
- Every push to your main branch
- Pull requests get preview deployments
- No configuration needed - it's that simple!

## Deployment Notes
- No build command required (static site)
- No environment variables needed
- All dependencies are loaded via CDN (Bootstrap, Font Awesome, PeerJS, Canvas Confetti)
- The site will automatically be served over HTTPS
- Custom domain support is available in Vercel dashboard

## Technologies Used
- HTML5
- CSS3 (Custom styles + Bootstrap 5)
- JavaScript (Vanilla JS)
- Bootstrap 5.3.0 (via CDN)
- Font Awesome 6.4.0 (via CDN)
- PeerJS 1.5.2 (for online multiplayer)
- Canvas Confetti (for celebrations)

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

Enjoy your game!
