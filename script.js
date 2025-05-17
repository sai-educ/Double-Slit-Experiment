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
        const y = canvas.height / 2;
        
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
                
                // Add some random deflection at slit
                p.vy += (Math.random() - 0.5) * 1.0;
                
                // In wave mode, we adjust trajectory based on interference
                if (detectionMode === 'wave') {
                    calculateWaveInterference(p, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen);
                }
            }
            
            // Check if particle passes through bottom slit
            else if (slitBottomOpen && Math.abs(p.y - slitBottomY) <= slitWidth / 2) {
                passesThroughSlit = true;
                
                // Add some random deflection at slit
                p.vy += (Math.random() - 0.5) * 1.0;
                
                // In wave mode, we adjust trajectory based on interference
                if (detectionMode === 'wave') {
                    calculateWaveInterference(p, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen);
                }
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
                
                // Update intensity data
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

function calculateWaveInterference(particle, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen) {
    // Only calculate interference if both slits are open
    if (slitTopOpen && slitBottomOpen) {
        // Calculate the angle from horizontal for each slit
        const slitTopAngle = Math.atan2(particle.y - slitTopY, canvas.width - BARRIER_X);
        const slitBottomAngle = Math.atan2(particle.y - slitBottomY, canvas.width - BARRIER_X);
        
        // Calculate path difference (in pixels)
        const pathDifference = Math.abs(slitTopY - slitBottomY) * Math.sin(slitTopAngle);
        
        // Calculate phase difference based on path difference and wavelength
        const phaseDifference = (pathDifference / WAVELENGTH) * Math.PI * 2;
        
        // Apply interference effect to particle velocity
        // Make particles more likely to move toward constructive interference regions
        const interferenceEffect = Math.cos(phaseDifference + particle.phaseOffset);
        particle.vy += interferenceEffect * 0.5;
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
    
    // Create grid of points for visualization
    const gridStepX = 10;
    const gridStepY = 10;
    
    for (let x = BARRIER_X + 20; x < canvas.width; x += gridStepX) {
        for (let y = 0; y < canvas.height; y += gridStepY) {
            // Calculate wave amplitude at this point from both slits
            let amplitude = 0;
            
            if (slitTopOpen) {
                const distFromTopSlit = Math.sqrt((x - BARRIER_X) ** 2 + (y - slitTopY) ** 2);
                const phaseTopSlit = (distFromTopSlit / WAVELENGTH) * Math.PI * 2;
                amplitude += Math.cos(phaseTopSlit - simulationTime * 10);
            }
            
            if (slitBottomOpen) {
                const distFromBottomSlit = Math.sqrt((x - BARRIER_X) ** 2 + (y - slitBottomY) ** 2);
                const phaseBottomSlit = (distFromBottomSlit / WAVELENGTH) * Math.PI * 2;
                amplitude += Math.cos(phaseBottomSlit - simulationTime * 10);
            }
            
            // Normalize amplitude
            if (slitTopOpen && slitBottomOpen) {
                amplitude /= 2;
            }
            
            // Map amplitude to color intensity
            const intensity = (amplitude + 1) / 2; // Map from [-1,1] to [0,1]
            
            // Draw dot with color based on intensity
            const particleType = document.getElementById('particle-type').value;
            const baseColor = particleType === 'electron' ? [76, 175, 80] : [0, 191, 255]; // RGB for electron or photon
            
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${intensity * 0.3})`;
            ctx.fill();
        }
    }
}

function drawDetectionScreen() {
    // Draw accumulated detections
    const detectionMode = document.getElementById('detection-mode').value;
    
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
        
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `${d.color}${Math.floor(d.opacity * 255).toString(16).padStart(2, '0')}`;
        ctx.fill();
    }
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
    
    // Draw intensity plot
    graphCtx.beginPath();
    for (let y = 0; y < intensityData.length; y++) {
        if (y === 0) {
            graphCtx.moveTo(canvas.width, graphBottom - (intensityData[y] / maxIntensity) * graphHeight);
        } else {
            graphCtx.lineTo(canvas.width, graphBottom - (intensityData[y] / maxIntensity) * graphHeight);
        }
    }
    graphCtx.lineTo(canvas.width, graphBottom);
    graphCtx.lineTo(canvas.width, graphBottom - (intensityData[0] / maxIntensity) * graphHeight);
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
}

function updateDetectionMode() {
    const detectionMode = document.getElementById('detection-mode').value;
    
    // In wave mode, we show wave patterns
    if (detectionMode === 'wave') {
        // We'll handle this in the visualization
    }
    
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

// Quantum wave functions adapted for visualization

/**
 * Calculates the probability amplitude at a point given the slit configuration
 */
function calculateProbabilityAmplitude(x, y, slitTopY, slitBottomY, slitTopOpen, slitBottomOpen) {
    // Skip calculation if no slits are open
    if (!slitTopOpen && !slitBottomOpen) {
        return 0;
    }
    
    let amplitude = { real: 0, imag: 0 };
    
    // Contribution from top slit
    if (slitTopOpen) {
        const distFromTopSlit = Math.sqrt((x - BARRIER_X) ** 2 + (y - slitTopY) ** 2);
        const phase = (distFromTopSlit / WAVELENGTH) * Math.PI * 2;
        amplitude.real += Math.cos(phase);
        amplitude.imag += Math.sin(phase);
    }
    
    // Contribution from bottom slit
    if (slitBottomOpen) {
        const distFromBottomSlit = Math.sqrt((x - BARRIER_X) ** 2 + (y - slitBottomY) ** 2);
        const phase = (distFromBottomSlit / WAVELENGTH) * Math.PI * 2;
        amplitude.real += Math.cos(phase);
        amplitude.imag += Math.sin(phase);
    }
    
    // Normalize based on number of open slits
    const normalizationFactor = (slitTopOpen && slitBottomOpen) ? 2 : 1;
    amplitude.real /= normalizationFactor;
    amplitude.imag /= normalizationFactor;
    
    return amplitude;
}

/**
 * Calculates the probability (amplitude squared) from a complex amplitude
 */
function calculateProbability(amplitude) {
    return amplitude.real * amplitude.real + amplitude.imag * amplitude.imag;
}

// Mathematical utility functions

/**
 * Calculates the distance between two points
 */
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Maps a value from one range to another
 */
function map(value, fromLow, fromHigh, toLow, toHigh) {
    return (value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
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

// Add some extra physics for a more realistic simulation
function applyQuantumEffects(particle) {
    // Small random "quantum" fluctuations in movement
    particle.vx += (Math.random() - 0.5) * 0.05;
    particle.vy += (Math.random() - 0.5) * 0.05;
    
    // Limit velocity to reasonable range
    const maxVel = 3;
    const velMag = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
    if (velMag > maxVel) {
        particle.vx = (particle.vx / velMag) * maxVel;
        particle.vy = (particle.vy / velMag) * maxVel;
    }
}

// Function to demonstrate the feynman path integral approach
function visualizeFeynmanPaths(startX, startY, endX, endY) {
    // This would be a more advanced feature to implement the "sum over all possible paths" approach
    // Here we just draw a representative sample of possible paths
    
    const numPaths = 20;
    ctx.globalAlpha = 0.2;
    
    for (let i = 0; i < numPaths; i++) {
        // Create a random path with some control points
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        // Random control points for a cubic bezier curve
        const cp1x = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * 50;
        const cp1y = startY + (Math.random() - 0.5) * 100;
        const cp2x = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * 50;
        const cp2y = endY + (Math.random() - 0.5) * 100;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
        
        ctx.strokeStyle = '#FFFF0080';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
}