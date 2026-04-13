import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './index.css';

const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const monthColors = ["#00e5ff", "#1de9b6", "#00e676", "#76ff03", "#ffea00", "#ff9100", "#ff3d00", "#ff1744", "#f50057", "#d500f9", "#651fff", "#2979ff"];
const genres = ["Action", "Drama", "Comedy", "Romance", "Animation", "Thriller", "Sci-Fi"];
const genreColors = {"Action": "#ff5252", "Drama": "#448aff", "Comedy": "#ffb142", "Romance": "#ff7979", "Animation": "#33d9b2", "Thriller": "#706fd3", "Sci-Fi": "#34ace0"};

function generateDummyData() {
    const data = [];
    let rank = 1;
    for (let m = 0; m < 12; m++) {
        const numMovies = Math.floor(Math.random() * 11) + 8; 
        for (let i = 0; i < numMovies; i++) {
            const isSpike = (m === 0 || m === 7 || m === 11) && Math.random() > 0.6;
            const value = isSpike ? Math.floor(Math.random() * 80) + 60 : Math.floor(Math.random() * 25) + 5;
            const genre = genres[Math.floor(Math.random() * genres.length)];
            data.push({
                id: `movie-${rank}`, name: `Blockbuster ${rank}`, year: Math.random() > 0.5 ? "2013" : "2014",
                value: value, month: months[m], monthIdx: m, genre: genre
            });
            rank++;
        }
    }
    data.sort((a, b) => b.value - a.value);
    data.forEach((d, i) => d.rank = i + 1);
    data.sort((a, b) => a.monthIdx - b.monthIdx);
    return data;
}

function App() {
  const [chartData, setChartData] = useState(generateDummyData());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const isMobile = window.innerWidth <= 768;
  const initialZoom = isMobile ? 0.35 : 0.75;
  
  // Ref to communicate with d3 animation loop
  const cameraRef = useRef({
      targetZoomScale: initialZoom,
      currentZoomScale: initialZoom,
      currentRotX: 55,
      currentRotZ: 0,
      velX: 0,
      velZ: 0,
      autoRotate: true,
      needsReset: false,
  });

  const zoomIn = () => {
      cameraRef.current.targetZoomScale += 0.2;
      cameraRef.current.targetZoomScale = Math.min(cameraRef.current.targetZoomScale, 15);
  };

  const zoomOut = () => {
      cameraRef.current.targetZoomScale -= 0.2;
      cameraRef.current.targetZoomScale = Math.max(cameraRef.current.targetZoomScale, 0.1);
  };

  const resetCamera = () => {
      cameraRef.current.autoRotate = false;
      cameraRef.current.velX = 0;
      cameraRef.current.velZ = 0;
      cameraRef.current.currentRotX = 0;
      cameraRef.current.currentRotZ = 0;
      cameraRef.current.targetZoomScale = initialZoom;
      cameraRef.current.currentZoomScale = initialZoom;
      const orbitNode = document.getElementById("orbit-group");
      if (orbitNode) {
          orbitNode.style.transition = 'transform 0.8s cubic-bezier(0.2, 1, 0.3, 1)';
          orbitNode.style.transform = `translateZ(0) scale(${initialZoom}) rotateX(0deg) rotateZ(0deg)`;
          setTimeout(() => { orbitNode.style.transition = 'none'; }, 800);
      }
  };

  useEffect(() => {
    const data = chartData;
    const orbitNode = document.getElementById("orbit-group");
    const wrapperElem = document.getElementById("chart-wrapper");
    if (orbitNode) orbitNode.innerHTML = "";
    const legendContainerNode = document.getElementById("legend-container");
    if (legendContainerNode) legendContainerNode.innerHTML = "";
    
    // Auto rescale for mobile/desktop initially
    cameraRef.current.targetZoomScale = window.innerWidth <= 768 ? 0.35 : 0.75;
    cameraRef.current.currentZoomScale = cameraRef.current.targetZoomScale;
    
    let isDragging = false;
    let lastX, lastY;
    let initialPinchDistance = null;
    let initialPinchZoom = null;

    const friction = 0.92;
    const sensitivity = 0.12; // Mobile-friendly sensibility

    function updateTransform() {
        if (orbitNode && orbitNode.style.transition === 'none' || !orbitNode.style.transition) {
             orbitNode.style.transform = `translateZ(0) scale(${cameraRef.current.currentZoomScale}) rotateX(${cameraRef.current.currentRotX}deg) rotateZ(${cameraRef.current.currentRotZ}deg)`;
             orbitNode.style.willChange = 'transform';
        }
    }

    let animationId;
    function animate() {
        let cam = cameraRef.current;
        if (cam.autoRotate && !isDragging) {
            cam.velZ = -0.06;
        }

        cam.currentRotX += cam.velX;
        cam.currentRotZ += cam.velZ;

        if (!isDragging) {
            cam.velX *= friction;
            cam.velZ *= friction;
        }

        const zoomLerpSpeed = 0.1;
        cam.currentZoomScale += (cam.targetZoomScale - cam.currentZoomScale) * zoomLerpSpeed;

        // Sleep optimization: if completely still, skip modifying DOM 
        const isMoving = Math.abs(cam.velX) > 0.01 || Math.abs(cam.velZ) > 0.01 || Math.abs(cam.targetZoomScale - cam.currentZoomScale) > 0.005 || cam.autoRotate;
        
        if (isMoving) {
            updateTransform();
        }

        animationId = requestAnimationFrame(animate);
    }
    animationId = requestAnimationFrame(animate);

    const onWheel = (e) => {
        e.preventDefault(); 
        cameraRef.current.autoRotate = false; 
        const zoomSensitivity = 0.0015;
        cameraRef.current.targetZoomScale += e.deltaY * -zoomSensitivity;
        cameraRef.current.targetZoomScale = Math.max(0.1, Math.min(cameraRef.current.targetZoomScale, 15)); 
    };

    const getPinchDistance = (touches) => {
        return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    };

    const onMouseDown = (e) => {
        isDragging = true; cameraRef.current.autoRotate = false;
        lastX = e.clientX; lastY = e.clientY;
        cameraRef.current.velX = 0; cameraRef.current.velZ = 0; 
    };

    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            isDragging = true; cameraRef.current.autoRotate = false;
            lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
            cameraRef.current.velX = 0; cameraRef.current.velZ = 0; 
        } else if (e.touches.length === 2) {
            initialPinchDistance = getPinchDistance(e.touches);
            initialPinchZoom = cameraRef.current.targetZoomScale;
            isDragging = false; 
            cameraRef.current.autoRotate = false;
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;

        const isUpsideDown = Math.cos(cameraRef.current.currentRotX * Math.PI / 180) < 0;
        cameraRef.current.velZ += dx * sensitivity * (isUpsideDown ? -1 : 1);
        cameraRef.current.velX -= dy * sensitivity; 
    };

    const onTouchMove = (e) => {
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastX;
            const dy = e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;

            const isUpsideDown = Math.cos(cameraRef.current.currentRotX * Math.PI / 180) < 0;
            cameraRef.current.velZ += dx * sensitivity * (isUpsideDown ? -1 : 1);
            cameraRef.current.velX -= dy * sensitivity; 
        } else if (e.touches.length === 2 && initialPinchDistance !== null) {
            // Pinch to zoom logic
            const currentDistance = getPinchDistance(e.touches);
            const scaleChange = currentDistance / initialPinchDistance;
            cameraRef.current.targetZoomScale = Math.max(0.1, Math.min(initialPinchZoom * scaleChange, 15));
        }
        if (e.cancelable) e.preventDefault();
    };

    const onRelease = () => { 
        isDragging = false; 
        initialPinchDistance = null;
    };

    wrapperElem.addEventListener("wheel", onWheel, { passive: false });
    wrapperElem.addEventListener("mousedown", onMouseDown);
    wrapperElem.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    wrapperElem.addEventListener("mouseleave", onRelease);

    // --- LAYERED SVG RENDERING ---
    const width = 1200;
    const height = 1200;
    const ringInnerRadius = 200;
    const ringOuterRadius = 230;
    const barStartRadius = 235;
    const barMaxRadius = 450;
    const extrusionLayersCount = 4; 
    const zSpacing = 7.5; 

    const orbitD3 = d3.select("#orbit-group");

    function createLayer(z, className) {
        return orbitD3.append("svg")
            .attr("class", `layer-svg ${className}`)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("transform", `translate3d(0,0,${z}px)`)
            .append("g")
            .attr("transform", `translate(${width / 2},${height / 2})`);
    }

    const lGrid = createLayer(0, "layer-grid");
    const lHub = createLayer(5, "layer-hub");
    const lChords = createLayer(10, "layer-chords");
    
    const extrusionLayers = [];
    for(let i=1; i<=extrusionLayersCount; i++) {
        extrusionLayers.push(createLayer(10 + (i * zSpacing), "layer-extrusion"));
    }
    
    const topZ = 10 + ((extrusionLayersCount + 1) * zSpacing);
    const lBarsTop = createLayer(topZ, "layer-bars-top");
    const lInteract = createLayer(topZ + 5, "layer-interact"); 

    const x = d3.scaleBand().range([0, 2 * Math.PI]).align(0).domain(data.map(d => d.id)).paddingInner(0.2);
    const y = d3.scaleLinear().range([barStartRadius, barMaxRadius]).domain([0, d3.max(data, d => d.value) || 1]);
    const mapColor = d3.scaleOrdinal().domain(months).range(monthColors);

    lGrid.selectAll("circle").data(y.ticks(5)).enter().append("circle")
        .attr("r", d => y(d)).style("fill", "none").style("stroke", "#2a2a35").style("stroke-dasharray", "4,4").style("opacity", 0.6);

    const coreGroup = lHub.append("g").attr("class", "data-core pointer-events-none");

    coreGroup.append("circle").attr("r", 12).attr("class", "core-pulse").attr("fill", "#00e5ff");
    coreGroup.append("circle").attr("r", 35).attr("class", "spin-fast-cw").style("fill", "none").style("stroke", "#00e5ff").style("stroke-width", 2).style("stroke-dasharray", "8, 6").style("opacity", 0.8);
    coreGroup.append("circle").attr("r", 55).attr("class", "spin-slow-ccw").style("fill", "none").style("stroke", "#d500f9").style("stroke-width", 1.5).style("stroke-dasharray", "20, 10, 5, 10").style("opacity", 0.6);
    coreGroup.append("circle").attr("r", 75).attr("class", "spin-slow-cw").style("fill", "none").style("stroke", "#1de9b6").style("stroke-width", 1).style("stroke-dasharray", "2, 10").style("opacity", 0.4);

    const genreNodes = {};
    const genreGroup = lChords.append("g").attr("class", "genre-labels");
    const genreStartY = -60; const genreStartX = -120;
    
    genres.forEach((g, i) => {
        genreNodes[g] = { x: genreStartX, y: genreStartY + (i * 22), color: genreColors[g] || "#fff" };
        const gNode = genreGroup.append("g").attr("class", `chart-element genre-node-${g.replace(/[\s\W]+/g, '')}`);
        gNode.append("text")
            .attr("x", genreStartX - 10).attr("y", genreStartY + (i * 22))
            .attr("fill", genreColors[g] || "#fff").attr("font-size", "12px").attr("font-weight", "600")
            .attr("text-anchor", "end").attr("alignment-baseline", "middle").text(g);
    });

    const lineGenerator = d3.line().curve(d3.curveBundle.beta(0.85));
    data.forEach((d, i) => {
        const angle = x(d.id) + x.bandwidth() / 2;
        const targetX = ringInnerRadius * Math.cos(angle - Math.PI/2);
        const targetY = ringInnerRadius * Math.sin(angle - Math.PI/2);
        const start = genreNodes[d.genre] || { x: 0, y: 0 };

        const pathData = lineGenerator([[start.x, start.y], [-40, 0], [targetX, targetY]]);
        
        const path = lChords.append("path")
            .attr("class", `chart-element chord-line chord-${d.id} item-month-${d.monthIdx} item-genre-${d.genre.replace(/[\s\W]+/g, '')}`)
            .attr("d", pathData).attr("fill", "none").attr("stroke", mapColor(d.month))
            .attr("stroke-width", "0.2px").attr("opacity", "0.15");
            
        const totalLength = path.node().getTotalLength() || 1000;
        path.attr("stroke-dasharray", totalLength + " " + totalLength).attr("stroke-dashoffset", totalLength)
            .transition().duration(1500).delay(i * 5).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);
    });

    d3.group(data, d => d.monthIdx).forEach((values, monthIdx) => {
        const startAngle = x(values[0].id);
        const endAngle = x(values[values.length - 1].id) + x.bandwidth();
        lChords.append("path").attr("fill", monthColors[monthIdx])
            .attr("d", d3.arc().innerRadius(ringInnerRadius).outerRadius(ringOuterRadius).startAngle(startAngle - 0.02).endAngle(endAngle + 0.02));
    });

    extrusionLayers.forEach(layer => {
        layer.selectAll("path").data(data).enter().append("path")
            .attr("class", d => `chart-element bar-${d.id} item-month-${d.monthIdx} item-genre-${d.genre.replace(/[\s\W]+/g, '')}`)
            .attr("fill", d => d3.color(mapColor(d.month)).darker(1.5))
            .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(barStartRadius).startAngle(d => x(d.id)).endAngle(d => x(d.id) + x.bandwidth()))
            .transition().duration(1200).delay((d, i) => i * 10)
            .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(d => y(d.value)).startAngle(d => x(d.id)).endAngle(d => x(d.id) + x.bandwidth()));
    });

    lBarsTop.selectAll("path").data(data).enter().append("path")
        .attr("class", d => `chart-element bar-${d.id} item-month-${d.monthIdx} item-genre-${d.genre.replace(/[\s\W]+/g, '')}`)
        .attr("fill", d => mapColor(d.month))
        .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(barStartRadius).startAngle(d => x(d.id)).endAngle(d => x(d.id) + x.bandwidth()))
        .transition().duration(1200).delay((d, i) => i * 10)
        .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(d => y(d.value)).startAngle(d => x(d.id)).endAngle(d => x(d.id) + x.bandwidth()));

    const labelNodes = lInteract.selectAll("g").data(data).enter().append("g")
        .attr("class", d => `chart-element label-group-${d.id} item-month-${d.monthIdx} item-genre-${d.genre.replace(/[\s\W]+/g, '')}`)
        .attr("transform", function(d) { return "rotate(" + ((x(d.id) + x.bandwidth() / 2) * 180 / Math.PI - 90) + ")"+"translate(" + (barStartRadius + 5) + ",0)"; });

    labelNodes.transition().duration(1200).delay((d, i) => i * 10)
        .attr("transform", function(d) { return "rotate(" + ((x(d.id) + x.bandwidth() / 2) * 180 / Math.PI - 90) + ")"+"translate(" + (y(d.value) + 5) + ",0)"; });

    labelNodes.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 8).attr("y2", 0).attr("stroke", d => mapColor(d.month)).attr("stroke-width", 0.8);
    labelNodes.append("circle").attr("cx", 14).attr("cy", 0).attr("r", 5).attr("fill", d => mapColor(d.month));
    labelNodes.append("text").attr("x", 14).attr("y", 0.5).attr("fill", "#000").attr("font-size", "5px").attr("font-weight", "bold").attr("text-anchor", "middle").attr("alignment-baseline", "middle")
        .attr("transform", function(d) { return (x(d.id) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "rotate(180, 14, 0)" : "rotate(0)"; }).text(d => d.rank);
    labelNodes.append("text").attr("x", 22).attr("y", 0).attr("class", "chart-text").attr("fill", "#94a3b8").attr("font-size", "7px")
        .attr("text-anchor", function(d) { return (x(d.id) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "end" : "start"; })
        .attr("transform", function(d) { return (x(d.id) + x.bandwidth() / 2 + Math.PI) % (2 * Math.PI) < Math.PI ? "rotate(180, 22, 0) translate(-60,0)" : "rotate(0)"; })
        .style("alignment-baseline", "middle").text(d => `[${d.year}] ${d.name}`);

    lInteract.selectAll(".hitbox").data(data).enter().append("path")
        .attr("class", "cursor-pointer")
        .attr("fill", "transparent")
        .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(d => y(d.value) + 20).startAngle(d => x(d.id)).endAngle(d => x(d.id) + x.bandwidth()))
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut)
        .on("click", handleClick);

    const centerHub = lHub.append("g").attr("class", "center-hub").style("opacity", 0);
    centerHub.append("circle").attr("r", 85).attr("fill", "#0a0a0f").attr("stroke", "rgba(255,255,255,0.1)").attr("stroke-width", 1);
    const hubContent = centerHub.append("g").attr("transform", "translate(0, -20)");
    const hubTitle = hubContent.append("text").attr("fill", "#fff").attr("font-size", "14px").attr("font-weight", "bold").attr("text-anchor", "middle").attr("alignment-baseline", "middle");
    const hubRank = hubContent.append("text").attr("y", 20).attr("fill", "#94a3b8").attr("font-size", "11px").attr("text-anchor", "middle").attr("alignment-baseline", "middle");
    const hubValue = hubContent.append("text").attr("y", 45).attr("fill", "#fff").attr("font-size", "22px").attr("font-weight", "800").attr("text-anchor", "middle").attr("alignment-baseline", "middle").attr("class", "pulse-text");
    const hubValueLabel = hubContent.append("text").attr("y", 62).attr("fill", "#64748b").attr("font-size", "9px").attr("text-anchor", "middle").attr("alignment-baseline", "middle").text("MILLION AUDIENCE");

    const tooltip = d3.select("#tooltip");
    let lockedData = null;

    function highlightElement(d) {
        d3.selectAll(".chart-element").classed("chart-dimmed", true);
        d3.selectAll(`.bar-${d.id}`).classed("chart-dimmed", false).classed("chart-highlight", true);
        
        d3.select(`.chord-${d.id}`).classed("chart-dimmed", false).classed("highlight-line", true);
        const labelGrp = d3.select(`.label-group-${d.id}`);
        labelGrp.classed("chart-dimmed", false);
        labelGrp.select(".chart-text").classed("highlight-text", true);
        d3.select(`.genre-node-${d.genre.replace(/[\s\W]+/g, '')}`).classed("chart-dimmed", false).classed("chart-highlight", true);
    }

    function handleMouseOver(event, d) {
        if (lockedData || isDragging) return;
        cameraRef.current.autoRotate = false;
        highlightElement(d);

        tooltip.transition().duration(100).style("opacity", 1);
        tooltip.html(`
            <div class="font-bold mb-2 flex items-center gap-2 text-sm border-b border-gray-700 pb-2">
                <span class="w-3 h-3 rounded-full" style="background:${mapColor(d.month)}"></span>
                [${d.year}] ${d.name}
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span class="text-gray-400">Rank</span> <span class="font-bold text-white text-right">#${d.rank}</span>
                <span class="text-gray-400">Genre</span> <span class="font-bold text-right" style="color:${genreColors[d.genre] || '#fff'}">${d.genre}</span>
                <span class="text-gray-400">Audience</span> <span class="font-bold text-white text-right">${d.value.toFixed(1)}M</span>
            </div>
        `);
    }

    const onGlobalMouseMove = (e) => {
        if (lockedData || isDragging) return;
        tooltip.style("left", (e.pageX) + "px").style("top", (e.pageY - 15) + "px");
    };

    window.addEventListener("mousemove", onGlobalMouseMove);

    function handleMouseOut() {
        if (!lockedData && !isDragging) resetHighlight();
    }

    function handleClick(event, d) {
        event.stopPropagation();
        if (lockedData && lockedData.id === d.id) {
            unlockAll();
        } else {
            lockedData = d;
            tooltip.style("opacity", 0);
            
            d3.selectAll(".chart-element").classed("chart-dimmed", true).classed("chart-highlight", false);
            d3.selectAll(".chord-line").classed("highlight-line", false);
            d3.selectAll(".chart-text").classed("highlight-text", false);
            highlightElement(d);

            hubTitle.text(`[${d.year}] ${d.name}`);
            hubRank.text(`Rank: #${d.rank} | ${d.genre}`);
            hubValue.text(`${(d.value).toFixed(1)}`).attr("fill", mapColor(d.month));
            centerHub.transition().duration(200).style("opacity", 1);
        }
    }

    function resetHighlight() {
        d3.selectAll(".chart-element").classed("chart-dimmed", false).classed("chart-highlight", false);
        d3.selectAll(".chord-line").classed("highlight-line", false);
        d3.selectAll(".chart-text").classed("highlight-text", false);
        tooltip.transition().duration(100).style("opacity", 0);
    }

    function unlockAll() {
        lockedData = null;
        centerHub.transition().duration(200).style("opacity", 0);
        resetHighlight();
    }

    const onWrapperClick = (e) => {
        if (e.target.tagName !== 'path' && e.target.tagName !== 'text') unlockAll();
    };
    wrapperElem.addEventListener("click", onWrapperClick);

    const legendContainer = d3.select("#legend-container");
    months.forEach((month, i) => {
        const topDataForMonth = data.filter(d => d.monthIdx === i).sort((a,b) => b.value - a.value)[0];
        const title = topDataForMonth ? topDataForMonth.name : `Data ${i+1}`;
        const item = legendContainer.append("div")
            .attr("class", "flex flex-col items-center cursor-pointer transition-transform hover:-translate-y-2 min-w-[50px]")
            .on("mouseover", function() {
                if (lockedData) return;
                d3.selectAll(".chart-element").classed("chart-dimmed", true);
                
                d3.selectAll(`.item-month-${i}`).classed("chart-dimmed", false);
                d3.selectAll(`.chord-line.item-month-${i}`).classed("highlight-line", true);
                d3.selectAll(`.item-month-${i} .chart-text`).classed("highlight-text", true);
                d3.selectAll(".genre-labels .chart-element").classed("chart-dimmed", false); 
            })
            .on("mouseout", () => { if(!lockedData) resetHighlight(); });
        
        item.append("div").attr("class", "legend-title").style("white-space", "nowrap").text(title);
        item.append("div").attr("class", "w-8 h-5").style("background-color", monthColors[i]);
        item.append("div").attr("class", "text-[10px] text-gray-500 font-bold mt-1").text(`${month}M`);
    });

    return () => {
        cancelAnimationFrame(animationId);
        wrapperElem.removeEventListener("wheel", onWheel);
        wrapperElem.removeEventListener("mousedown", onMouseDown);
        wrapperElem.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("mouseup", onRelease);
        window.removeEventListener("touchend", onRelease);
        wrapperElem.removeEventListener("mouseleave", onRelease);
        window.removeEventListener("mousemove", onGlobalMouseMove);
        wrapperElem.removeEventListener("click", onWrapperClick);
    };
  }, [chartData]);

  const processFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setJsonError("Please upload a valid .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (Array.isArray(json) && json.length > 0 && json[0].value !== undefined) {
          // Add default formatting if missing
          const validatedData = json.map((d, i) => ({
             ...d,
             id: d.id || `data-${i}`,
             name: d.name || `Data ${i+1}`,
             year: d.year || "2024",
             value: Number(d.value),
             month: d.month || months[0],
             monthIdx: d.monthIdx !== undefined ? d.monthIdx : (months.indexOf(d.month) > -1 ? months.indexOf(d.month) : 0),
             genre: d.genre || genres[0]
          }));

          validatedData.sort((a, b) => b.value - a.value);
          validatedData.forEach((d, i) => d.rank = i + 1);
          validatedData.sort((a, b) => a.monthIdx - b.monthIdx);
          
          setChartData(validatedData);
          setIsModalOpen(false);
          setJsonError("");
        } else {
            setJsonError("Invalid JSON structure. Needs array of objects with a 'value' property.");
        }
      } catch (err) {
        setJsonError("Error parsing JSON file. Please check format.");
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const dummyJsonExample = `[
  {
    "name": "My Custom Data 1",
    "value": 120,
    "year": "2024",
    "month": "1",
    "monthIdx": 0,
    "genre": "Action"
  }
]`;

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white relative" style={{ background: "radial-gradient(circle at center, #0f0f13 0%, #060606 100%)" }}>
      <svg style={{ width: 0, height: 0, position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div id="tooltip"></div>

      {/* Main Chart Wrapper */}
      <div className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden" id="chart-wrapper">
        <div id="orbit-group"></div>
        
        {/* Floating Tooltips and Controls container - Responsive */}
        <div className="absolute top-4 left-4 md:top-6 md:left-10 pointer-events-none flex flex-col gap-2 z-10 w-48 md:w-auto">
          <div className="flex items-center gap-2 md:gap-3 bg-black/40 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Hover & Click Data Nodes</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 bg-black/40 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10 hidden md:flex">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Click & Drag to Rotate 3D Space</span>
          </div>
          <button onClick={resetCamera} className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10 pointer-events-auto hover:bg-white/10 transition-colors text-left cursor-pointer group mt-2">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 group-hover:text-cyan-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium group-hover:text-white transition-colors">Snap to 2D Image View</span>
          </button>
        </div>

        {/* Right side floating controls (Zoom & Upload) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-10 flex flex-col gap-3 z-10 items-end">
             <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 px-4 py-2 rounded-full border border-white/20 pointer-events-auto transition text-white font-semibold text-xs md:text-sm shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:scale-105 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Upload Data
             </button>

             {/* Zoom Controls for Mobile/Desktop Touch */}
             <div className="flex flex-col gap-2 mt-4 hidden md:flex">
                 <button onClick={zoomIn} className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 </button>
                 <button onClick={zoomOut} className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                 </button>
             </div>
             
             {/* Simpler zoom control for mobile */}
             <div className="flex md:hidden gap-2 mt-2 pointer-events-auto">
                 <button onClick={zoomOut} className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                 </button>
                 <button onClick={zoomIn} className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 </button>
             </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-10 pb-12 flex flex-col lg:flex-row justify-between items-center lg:items-end gap-10">
        <div className="max-w-xl z-10 relative hidden lg:block"></div>
        <div className="flex flex-col items-center lg:items-end z-10 relative pointer-events-none w-full">
          <div id="legend-container" className="flex items-end gap-[2px] md:gap-1 mb-2 pointer-events-auto overflow-x-auto max-w-full pb-4 scrollbar-hide" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}></div>
          <p className="text-[10px] md:text-[11px] text-gray-400 tracking-wide text-center lg:text-right">[Monthly Color Index & Top Grossing Movie/Data]</p>
        </div>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111116] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative transition-all">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Upload Custom Dataset</h2>
                <p className="text-xs text-gray-400 mb-6">Select a JSON file containing an array of objects to visualize in 3D.</p>
                
                <div 
                    className="border border-dashed border-cyan-500/50 bg-cyan-900/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-cyan-900/20 transition group"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" id="json-upload" />
                    <label htmlFor="json-upload" className="cursor-pointer flex flex-col items-center w-full h-full">
                        <svg className="w-10 h-10 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        <span className="text-cyan-300 font-medium">Click to browse or drag file</span>
                        <span className="text-[10px] text-gray-500 mt-1">.json files only</span>
                    </label>
                </div>

                {jsonError && <div className="mt-4 text-red-400 text-xs text-center p-2 bg-red-900/20 rounded border border-red-500/30">{jsonError}</div>}

                <div className="mt-6 bg-black/40 rounded-lg p-4">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">EXPECTED JSON FORMAT:</div>
                    <pre className="text-[10px] text-cyan-200/70 overflow-x-auto p-2 bg-black/50 rounded inline-block w-full">
                        {dummyJsonExample}
                    </pre>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

export default App;
