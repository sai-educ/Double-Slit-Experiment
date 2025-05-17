// Constants and configuration
const EMITTER_X = 70;  // X position of emitter
const BARRIER_X = 150; // X position of barrier
const SCREEN_MIN_X = 250; // Start X of detection screen
const PARTICLE_SPEED = 2.5;
const WAVELENGTH = 20; // Base wavelength of the particles

// State variables
let canvas, ctx;
let particles = [];
let detections = [];
let intensityData = new Array(400).fill(0);
let particlesFired = 0;
let simulationTime = 0;
let animationId = null;
let lastTimestamp = 0;
let oneByOneMode = false;
let oneByOneParticleFired = false;

// Initialize the simulation
document.addEventListener('DOMContentLoaded', function() {
    // Get canvas and create context
    canvas = document.getElementById('detection-screen');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx = canvas.getContext('2d');
    
    // Initialize slits
    updateSlits();
    
    // Set up event listeners for controls
    document.getElementById('particle-rate').addEventListener('input', updateEmissionRate);
    document.getElementById('slit-width').addEventListener('input', updateSlits);
    document.getElementById('slit-distance').addEventListener('input', updateSlits);
    document.getElementById('particle-type').addEventListener('change', updateParticleType);
    document.getElementById('detection-mode').addEventListener('change', updateDetectionMode);
    document.getElementById('reset-btn').addEventListener('click', resetSimulation);
    document.getElementById('one-by-one-btn').addEventListener('click', toggleOneByOne);
    document.getElementById('show-paths').addEventListener('change', updatePathVisibility);
    document.getElementById('slit1').addEventListener('change', updateSlits);
    document.getElementById('slit2').addEventListener('change', updateSlits);
    
    // Start the simulation
    startSimulation();
});

function startSimulation() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    lastTimestamp = performance.now();
    animateSimulation();
}

function animateSimulation(timestamp) {
    if (!lastTimestamp) {
        lastTimestamp = timestamp;
    }
    
    const deltaTime = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    
    // Update simulation time
    simulationTime += deltaTime / 1000;
    document.getElementById('sim-time').textContent = simulationTime.toFixed(1);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create new particles
    if (!oneByOneMode || !oneByOneParticleFired) {
        createParticles();
        if (oneByOneMode) {
            oneByOneParticleFired = true;
        }
    }
    
    // Update and draw particles
    updateParticles();
    
    // Draw detection screen
    drawDetectionScreen();
    
    // Draw intensity graph
    drawIntensityGraph();
    
    // Continue animation
    animationId = requestAnimationFrame(animateSimulation);
}

function createParticles() {
    const emissionRate = parseInt(document.getElementById('particle-rate').value);
    const detectionMode = document.getElementById('detection-mode').value;
    const particleType = document.getElementById('particle-type').value;
    
    // Calculate probability of emission in this frame
    const emissionProbability = emissionRate / 100;
    
    if (Math.random() < emissionProbability) {
        const y = canvas.height / 2 + (Math.random() - 0.5) * 5; // Tiny variation in starting position
        
        let particle = {
            x: EMITTER_X,
            y: y, 
            vx: PARTICLE_SPEED,
            vy: 0,
            size: particleType === 'electron' ? 3 : 2,
            color: particleType === 'electron' ? '#4CAF50' : '#00BFFF',
            paths: [],
            passedBarrier: false,
            phaseOffset: Math.random() * Math.PI * 2, // Random phase for interference calculation
            detectable: true
        };
        
        particles.push(particle);
        particlesFired++;
        document.getElementById('particles-fired').textContent = particlesFired;
    }
}

function updateParticles() {
    const detectionMode = document.getElementById('detection-mode').value;
    const showPaths = document.getElementById('show-paths').checked;
    
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        
        // Record current position for path
        if (showPaths && p.paths.length % 3 === 0) {
            p.paths.push({x: p.x, y: p.y});
        }
        
        // Check if particle is at barrier
        if (p.x >= BARRIER_X && !p.passedBarrier) {
            p.passedBarrier = true;
            // Determine if particle passes through slits
            const slitTopOpen = document.getElementById('slit1').checked;
            const slitBottomOpen = document.getElementById('slit2').checked;
            const slitTopY = getSlitTopY();
            const slitBottomY = getSlitBottomY();
            const slitWidth = parseInt(document.getElementById('slit-width').value);
            
            let passesThroughSlit = false;
            
            // Check if particle passes through top slit
            if (slitTopOpen && Math.abs(p.y - slitTopY) <= slitWidth / 2) {
                passesThroughSlit = true;
                
                // Add very small random deflection at slit - will be dominated by interference
                p.vy += (Math.random() - 0.5) * 0.2;
                
                // Calculate quantum interference as principal effect
                calculateInterference(p, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen);
            }
            
            // Check if particle passes through bottom slit
            else if (slitBottomOpen && Math.abs(p.y - slitBottomY) <= slitWidth / 2) {
                passesThroughSlit = true;
                
                // Add very small random deflection at slit - will be dominated by interference
                p.vy += (Math.random() - 0.5) * 0.2;
                
                // Calculate quantum interference as principal effect
                calculateInterference(p, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen);
            }
            
            // If particle doesn't pass through any slit, remove it
            if (!passesThroughSlit) {
                particles.splice(i, 1);
                continue;
            }
        }
        
        // Move particle
        p.x += p.vx;
        p.y += p.vy;
        
        // Check if particle hits detection screen
        if (p.x >= canvas.width) {
            // Record hit location
            if (p.detectable) {
                detections.push({
                    x: canvas.width,
                    y: p.y,
                    color: p.color,
                    time: simulationTime,
                    opacity: 1.0
                });
                
                // Update intensity data - ensure it's within bounds
                const yIndex = Math.floor(p.y);
                if (yIndex >= 0 && yIndex < intensityData.length) {
                    intensityData[yIndex] += 1;
                }
            }
            
            // Remove particle
            particles.splice(i, 1);
            
            // In one-by-one mode, allow firing next particle
            if (oneByOneMode) {
                oneByOneParticleFired = false;
            }
            
            continue;
        }
        
        // Draw particle
        if (detectionMode !== 'wave' || p.x < BARRIER_X) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        } else {
            // In wave mode after barrier, don't show particle
        }
        
        // Draw path if enabled
        if (showPaths && p.paths.length > 1) {
            ctx.beginPath();
            ctx.moveTo(p.paths[0].x, p.paths[0].y);
            for (let j = 1; j < p.paths.length; j++) {
                ctx.lineTo(p.paths[j].x, p.paths[j].y);
            }
            ctx.lineTo(p.x, p.y);
            ctx.strokeStyle = `${p.color}80`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
    
    // Visualize wave patterns in wave mode
    if (detectionMode === 'wave') {
        visualizeWavePattern();
    }
}

function calculateInterference(particle, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen) {
    // Only calculate interference if both slits are open
    if (slitTopOpen && slitBottomOpen) {
        // Get the distance from the particle to the screen
        const distToScreen = canvas.width - particle.x;
        
        // Calculate path lengths from each slit to potential points on the screen
        for (let screenY = 0; screenY < canvas.height; screenY += 5) {
            // Calculate the distances from each slit to this point on the screen
            const distFromTopSlit = Math.sqrt(distToScreen**2 + (screenY - slitTopY)**2);
            const distFromBottomSlit = Math.sqrt(distToScreen**2 + (screenY - slitBottomY)**2);
            
            // Calculate the path difference
            const pathDifference = Math.abs(distFromTopSlit - distFromBottomSlit);
            
            // Calculate the phase difference
            const phaseDifference = (pathDifference / WAVELENGTH) * Math.PI * 2;
            
            // Calculate the probability amplitude for this position using quantum interference
            const probability = Math.cos(phaseDifference / 2) ** 2;
            
            // If particle is close to this screenY, adjust its velocity based on probability
            if (Math.abs(particle.y + particle.vy * distToScreen/particle.vx - screenY) < 10) {
                // Direction toward this point
                const direction = (screenY - particle.y) > 0 ? 1 : -1;
                
                // Adjust vy based on probability (more probable positions create stronger pull)
                // This creates natural movement toward interference maxima, away from minima
                particle.vy += direction * probability * 0.02;
            }
        }
    }
}

function visualizeWavePattern() {
    // Skip visualization if no slits are open
    if (!document.getElementById('slit1').checked && !document.getElementById('slit2').checked) {
        return;
    }
    
    // Get slit positions
    const slitTopY = getSlitTopY();
    const slitBottomY = getSlitBottomY();
    const slitTopOpen = document.getElementById('slit1').checked;
    const slitBottomOpen = document.getElementById('slit2').checked;
    
    // Show interference pattern on screen
    const screenX = canvas.width - 5; // Just before the right edge
    
    ctx.save();
    ctx.globalAlpha = 0.5;
    
    // Draw the actual interference pattern on screen
    for (let y = 0; y < canvas.height; y++) {
        // Calculate wave contributions from each slit
        let amplitude = 0;
        
        if (slitTopOpen) {
            const distFromTopSlit = Math.sqrt((screenX - BARRIER_X)**2 + (y - slitTopY)**2);
            const phaseTopSlit = (distFromTopSlit / WAVELENGTH) * Math.PI * 2;
            amplitude += Math.cos(phaseTopSlit - simulationTime * 5);
        }
        
        if (slitBottomOpen) {
            const distFromBottomSlit = Math.sqrt((screenX - BARRIER_X)**2 + (y - slitBottomY)**2);
            const phaseBottomSlit = (distFromBottomSlit / WAVELENGTH) * Math.PI * 2;
            amplitude += Math.cos(phaseBottomSlit - simulationTime * 5);
        }
        
        // Normalize amplitude
        if (slitTopOpen && slitBottomOpen) {
            amplitude /= 2;
        }
        
        // Calculate intensity (probability)
        const intensity = Math.pow(amplitude, 2); // Square of amplitude for probability
        
        // Map intensity to brightness (0 to 1)
        const brightness = (intensity + 1) / 2;
        
        // Draw line at this y position with appropriate brightness
        const particleType = document.getElementById('particle-type').value;
        const baseColor = particleType === 'electron' ? [76, 175, 80] : [0, 191, 255]; // RGB for electron or photon
        
        ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${brightness * 0.5})`;
        ctx.fillRect(screenX - 10, y, 10, 1);
    }
    
    // Draw visualized wavefronts if both slits are open
    if (slitTopOpen && slitBottomOpen) {
        const phaseOffset = simulationTime * 10 % (Math.PI * 2);
        
        for (let radius = 10; radius < canvas.width; radius += WAVELENGTH) {
            // Draw wavefront from top slit
            ctx.beginPath();
            ctx.arc(BARRIER_X, slitTopY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 - radius/canvas.width * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Draw wavefront from bottom slit
            ctx.beginPath();
            ctx.arc(BARRIER_X, slitBottomY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 - radius/canvas.width * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }
    }
    
    ctx.restore();
}

function drawDetectionScreen() {
    // Draw actual screen background
    ctx.fillStyle = '#111';
    ctx.fillRect(canvas.width - 10, 0, 10, canvas.height);
    
    // Create interference pattern visualization on the screen
    const slitTopOpen = document.getElementById('slit1').checked;
    const slitBottomOpen = document.getElementById('slit2').checked;
    
    if (slitTopOpen && slitBottomOpen) {
        // If both slits are open, draw proper interference pattern
        drawInterferencePattern();
    } else if (slitTopOpen || slitBottomOpen) {
        // If only one slit is open, draw single-slit diffraction pattern
        drawSingleSlitPattern(slitTopOpen ? getSlitTopY() : getSlitBottomY());
    }
    
    // Draw accumulated detections
    const detectionMode = document.getElementById('detection-mode').value;
    
    // Draw bright spots for each detection
    for (let i = detections.length - 1; i >= 0; i--) {
        const d = detections[i];
        
        // In accumulation mode, detections stay permanently
        // In particle detection mode, they fade over time
        if (detectionMode === 'particle') {
            d.opacity -= 0.01;
            if (d.opacity <= 0) {
                detections.splice(i, 1);
                continue;
            }
        }
        
        // Draw detection point on screen
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${d.color}${Math.floor(d.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
    }
}

function drawInterferencePattern() {
    // Draw the classic double-slit interference pattern on the screen
    const slitTopY = getSlitTopY();
    const slitBottomY = getSlitBottomY();
    const slitDistance = slitBottomY - slitTopY;
    const slitWidth = parseInt(document.getElementById('slit-width').value);
    
    // Calculate parameters for interference pattern
    const screenDistance = canvas.width - BARRIER_X; // Distance from barrier to screen
    const screenX = canvas.width - 5; // Position to draw screen pattern
    
    // Set up pattern drawing
    ctx.save();
    
    // Create a vertical gradient showing the interference pattern
    for (let y = 0; y < canvas.height; y++) {
        // Calculate the angle from the midpoint between slits to this position on screen
        const theta = Math.atan2(y - (slitTopY + slitBottomY)/2, screenDistance);
        
        // For double-slit pattern: intensity = cos²(π·d·sin(θ)/λ) · sinc²(π·w·sin(θ)/λ)
        // where d is slit separation, w is slit width, λ is wavelength
        
        // Calculate path difference
        const pathDifference = slitDistance * Math.sin(theta);
        // Phase difference (in radians)
        const phaseDifference = (pathDifference / WAVELENGTH) * Math.PI;
        
        // Double-slit interference factor
        const interferencePattern = Math.cos(phaseDifference) ** 2;
        
        // Single-slit diffraction factor (sinc function)
        const diffraction = slitWidth > 0 ? 
            Math.sin(Math.PI * slitWidth * Math.sin(theta) / WAVELENGTH) / 
            (Math.PI * slitWidth * Math.sin(theta) / WAVELENGTH) : 1;
        const diffractionPattern = diffraction ** 2;
        
        // Combined intensity (normalized to 0-1 range)
        let intensity = interferencePattern * diffractionPattern;
        
        // Apply some contrast enhancement to make pattern more visible
        intensity = Math.pow(intensity, 0.7);
        
        // Draw a pixel of the pattern
        const particleType = document.getElementById('particle-type').value;
        const color = particleType === 'electron' ? '#4CAF50' : '#00BFFF';
        
        // Convert to white for high intensities for more realistic look
        const r = Math.min(255, 255 * intensity);
        const g = Math.min(255, 255 * intensity);
        const b = Math.min(255, 255 * intensity);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(screenX, y, 5, 1);
    }
    
    ctx.restore();
}

function drawSingleSlitPattern(slitY) {
    // Draw a single-slit diffraction pattern
    const slitWidth = parseInt(document.getElementById('slit-width').value);
    const screenDistance = canvas.width - BARRIER_X;
    const screenX = canvas.width - 5;
    
    ctx.save();
    
    for (let y = 0; y < canvas.height; y++) {
        // Calculate the angle from the slit to this position on screen
        const theta = Math.atan2(y - slitY, screenDistance);
        
        // Single-slit diffraction: intensity = sinc²(π·w·sin(θ)/λ)
        const alpha = Math.PI * slitWidth * Math.sin(theta) / WAVELENGTH;
        
        // Avoid division by zero
        let diffractionPattern;
        if (Math.abs(alpha) < 0.001) {
            diffractionPattern = 1;
        } else {
            diffractionPattern = (Math.sin(alpha) / alpha) ** 2;
        }
        
        // Apply some contrast enhancement
        const intensity = Math.pow(diffractionPattern, 0.7);
        
        // Draw a pixel of the pattern
        const r = Math.min(255, 255 * intensity);
        const g = Math.min(255, 255 * intensity);
        const b = Math.min(255, 255 * intensity);
        
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(screenX, y, 5, 1);
    }
    
    ctx.restore();
}

function drawIntensityGraph() {
    const graphCtx = ctx;
    const graphHeight = 100;
    const graphBottom = canvas.height;
    
    // Find maximum intensity for scaling
    const maxIntensity = Math.max(...intensityData, 1);
    
    // Draw graph background
    graphCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    graphCtx.fillRect(0, canvas.height - graphHeight, canvas.width, graphHeight);
    
    // Draw axis
    graphCtx.beginPath();
    graphCtx.moveTo(0, canvas.height - graphHeight);
    graphCtx.lineTo(canvas.width, canvas.height - graphHeight);
    graphCtx.strokeStyle = '#666';
    graphCtx.lineWidth = 1;
    graphCtx.stroke();
    
    // Smooth the intensity data for better visualization
    const smoothedData = smoothArray(intensityData, 3);
    
    // Draw intensity plot
    graphCtx.beginPath();
    
    // Start at the left edge
    graphCtx.moveTo(0, canvas.height - (smoothedData[0] / maxIntensity) * graphHeight);
    
    // Plot all points
    for (let y = 1; y < smoothedData.length; y++) {
        const x = y / smoothedData.length * canvas.width;
        const intensity = smoothedData[y] / maxIntensity;
        graphCtx.lineTo(x, canvas.height - intensity * graphHeight);
    }
    
    // Complete the shape to fill
    graphCtx.lineTo(canvas.width, canvas.height);
    graphCtx.lineTo(0, canvas.height);
    graphCtx.closePath();
    
    const particleType = document.getElementById('particle-type').value;
    const gradientColor = particleType === 'electron' ? '#4CAF50' : '#00BFFF';
    
    const gradient = graphCtx.createLinearGradient(0, canvas.height - graphHeight, 0, canvas.height);
    gradient.addColorStop(0, `${gradientColor}FF`);
    gradient.addColorStop(1, `${gradientColor}00`);
    
    graphCtx.fillStyle = gradient;
    graphCtx.fill();
    
    graphCtx.lineWidth = 2;
    graphCtx.strokeStyle = gradientColor;
    graphCtx.stroke();
}

// Helper function to smooth an array (used for intensity graph)
function smoothArray(array, windowSize) {
    const result = [];
    
    for (let i = 0; i < array.length; i++) {
        let sum = 0;
        let count = 0;
        
        for (let j = Math.max(0, i - windowSize); j <= Math.min(array.length - 1, i + windowSize); j++) {
            sum += array[j];
            count++;
        }
        
        result[i] = sum / count;
    }
    
    return result;
}

function updateEmissionRate() {
    // This function is handled by the event listener directly modifying the input value
}

function updateSlits() {
    const slitWidth = parseInt(document.getElementById('slit-width').value);
    const slitDistance = parseInt(document.getElementById('slit-distance').value);
    const slitTopOpen = document.getElementById('slit1').checked;
    const slitBottomOpen = document.getElementById('slit2').checked;
    
    // Update DOM elements
    const slitTop = document.querySelector('.slit-top');
    const slitBottom = document.querySelector('.slit-bottom');
    
    // Set slit positions
    slitTop.style.height = `${slitWidth}px`;
    slitBottom.style.height = `${slitWidth}px`;
    
    // Calculate slit center positions
    const centerY = document.querySelector('.barrier').clientHeight / 2;
    slitTop.style.top = `${centerY - slitDistance/2}px`;
    slitBottom.style.top = `${centerY + slitDistance/2}px`;
    
    // Set slit visibility
    slitTop.style.display = slitTopOpen ? 'block' : 'none';
    slitBottom.style.display = slitBottomOpen ? 'block' : 'none';
    
    // Reset detections when slits change
    if (document.getElementById('detection-mode').value === 'accumulation') {
        detections = [];
        intensityData = new Array(400).fill(0);
    }
}

function getSlitTopY() {
    const slitDistance = parseInt(document.getElementById('slit-distance').value);
    return canvas.height / 2 - slitDistance / 2;
}

function getSlitBottomY() {
    const slitDistance = parseInt(document.getElementById('slit-distance').value);
    return canvas.height / 2 + slitDistance / 2;
}

function updateParticleType() {
    const particleType = document.getElementById('particle-type').value;
    const emitter = document.getElementById('emitter');
    
    if (particleType === 'electron') {
        emitter.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.5)';
        emitter.style.backgroundColor = '#555';
    } else { // photon
        emitter.style.boxShadow = '0 0 10px rgba(0, 191, 255, 0.5)';
        emitter.style.backgroundColor = '#555';
    }
    
    // Reset when particle type changes
    resetSimulation();
}

function updateDetectionMode() {
    const detectionMode = document.getElementById('detection-mode').value;
    
    // In particle detection mode, we clear accumulated detections
    if (detectionMode === 'particle') {
        // Make detections fade over time
        for (let d of detections) {
            d.opacity = 1.0; // Reset opacity to make them visible briefly
        }
    }
}

function updatePathVisibility() {
    // This is handled directly in the particle update function
}

function resetSimulation() {
    // Clear all particles and detections
    particles = [];
    detections = [];
    intensityData = new Array(400).fill(0);
    particlesFired = 0;
    simulationTime = 0;
    
    // Reset counters
    document.getElementById('particles-fired').textContent = '0';
    document.getElementById('sim-time').textContent = '0.0';
    
    // Reset one-by-one mode
    oneByOneMode = false;
    oneByOneParticleFired = false;
    document.getElementById('one-by-one-btn').textContent = 'Fire One-by-One';
}

function toggleOneByOne() {
    oneByOneMode = !oneByOneMode;
    oneByOneParticleFired = false;
    
    if (oneByOneMode) {
        document.getElementById('one-by-one-btn').textContent = 'Continuous Fire';
    } else {
        document.getElementById('one-by-one-btn').textContent = 'Fire One-by-One';
    }
}

// Handle window resize
window.addEventListener('resize', function() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    // Rescale intensity data
    const oldIntensityData = [...intensityData];
    intensityData = new Array(canvas.height).fill(0);
    
    // Simple rescaling of intensity data
    for (let i = 0; i < oldIntensityData.length; i++) {
        const newIndex = Math.floor(i * canvas.height / oldIntensityData.length);
        if (newIndex < intensityData.length) {
            intensityData[newIndex] += oldIntensityData[i];
        }
    }
});