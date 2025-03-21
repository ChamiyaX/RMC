document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const imageUpload = document.getElementById('imageUpload');
    const uploadContainer = document.getElementById('uploadContainer');
    const editorContainer = document.getElementById('editorContainer');
    const previewCanvas = document.getElementById('previewCanvas');
    const textInput = document.getElementById('textInput');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontColor = document.getElementById('fontColor');
    const fontFamily = document.getElementById('fontFamily');
    const textDepth = document.getElementById('textDepth');
    const textDepthValue = document.getElementById('textDepthValue');
    const textDensity = document.getElementById('textDensity');
    const textDensityValue = document.getElementById('textDensityValue');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const backBtn = document.getElementById('backBtn');
    const openEditorBtn = document.getElementById('openEditorBtn');
    const loadingContainer = document.getElementById('loadingContainer');
    const shareDesignBtn = document.getElementById('shareDesignBtn');
    const textPositionX = document.getElementById('textPositionX');
    const textPositionXValue = document.getElementById('textPositionXValue');
    const textPositionY = document.getElementById('textPositionY');
    const textPositionYValue = document.getElementById('textPositionYValue');

    // Canvas context
    const ctx = previewCanvas.getContext('2d');

    // Variables to store image and segmentation data
    let originalImage = null;
    let segmentationMask = null;
    let bodyPixModel = null;
    let currentDesignDataUrl = null;

    // Initialize BodyPix model
    async function loadBodyPixModel() {
        try {
            bodyPixModel = await bodyPix.load({
                architecture: 'MobileNetV1',
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2
            });
            console.log('BodyPix model loaded successfully');
        } catch (error) {
            console.error('Failed to load BodyPix model:', error);
        }
    }

    // Load the model when the page loads
    loadBodyPixModel();

    // Event Listeners
    uploadArea.addEventListener('click', () => imageUpload.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('active');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('active');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('active');

        if (e.dataTransfer.files.length) {
            imageUpload.files = e.dataTransfer.files;
            handleImageUpload(e.dataTransfer.files[0]);
        }
    });

    imageUpload.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleImageUpload(e.target.files[0]);
        }
    });

    openEditorBtn.addEventListener('click', () => {
        if (!originalImage) {
            imageUpload.click();
        } else {
            showEditor();
        }
    });

    backBtn.addEventListener('click', () => {
        uploadContainer.style.display = 'block';
        editorContainer.style.display = 'none';
    });

    // Update preview when text options change
    textInput.addEventListener('input', updatePreview);
    fontSize.addEventListener('input', () => {
        fontSizeValue.textContent = `${fontSize.value}px`;
        updatePreview();
    });
    fontColor.addEventListener('input', updatePreview);
    fontFamily.addEventListener('change', updatePreview);
    textDepth.addEventListener('input', () => {
        textDepthValue.textContent = textDepth.value;
        updatePreview();
    });
    textPositionX.addEventListener('input', () => {
        textPositionXValue.textContent = `${textPositionX.value}%`;
        updatePreview();
    });
    textPositionY.addEventListener('input', () => {
        textPositionYValue.textContent = `${textPositionY.value}%`;
        updatePreview();
    });

    // Reset button
    resetBtn.addEventListener('click', () => {
        textInput.value = '';
        fontSize.value = 40;
        fontSizeValue.textContent = '40px';
        fontColor.value = '#ffffff';
        fontFamily.value = 'Arial';
        textDepth.value = 5;
        textDepthValue.textContent = '5';
        textPositionX.value = 50;
        textPositionXValue.textContent = '50%';
        textPositionY.value = 50;
        textPositionYValue.textContent = '50%';
        updatePreview();
    });

    // Download button
    downloadBtn.addEventListener('click', downloadImage);

    // Share buttons
    shareBtn.addEventListener('click', shareImage);
    shareDesignBtn.addEventListener('click', shareImage);

    function showEditor() {
        uploadContainer.style.display = 'none';
        editorContainer.style.display = 'block';
    }

    // Handle image upload
    async function handleImageUpload(file) {
        if (!file.type.match('image.*')) {
            alert('Please upload an image file');
            return;
        }

        loadingContainer.style.display = 'flex';

        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();
            img.onload = async function() {
                originalImage = img;

                // Set canvas dimensions
                const maxWidth = 800;
                const maxHeight = 600;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    const ratio = maxWidth / width;
                    width = maxWidth;
                    height = height * ratio;
                }

                if (height > maxHeight) {
                    const ratio = maxHeight / height;
                    height = maxHeight;
                    width = width * ratio;
                }

                previewCanvas.width = width;
                previewCanvas.height = height;

                // Draw original image
                ctx.drawImage(img, 0, 0, width, height);

                // Process image with BodyPix with improved settings
                if (bodyPixModel) {
                    try {
                        // Use more detailed segmentation options
                        const segmentationConfig = {
                            flipHorizontal: false,
                            internalResolution: 'high',
                            segmentationThreshold: 0.6, // Lower threshold to catch more of the subject
                            scoreThreshold: 0.2,
                            nmsRadius: 20,
                            minKeypointScore: 0.3,
                            refineSteps: 10
                        };

                        // First segmentation attempt
                        let segmentation = await bodyPixModel.segmentPerson(previewCanvas, segmentationConfig);

                        // Create a temporary canvas to visualize and refine the mask
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = width;
                        tempCanvas.height = height;
                        const tempCtx = tempCanvas.getContext('2d');

                        // Try multiple segmentation approaches and combine results
                        const multiPersonConfig = {
                            ...segmentationConfig,
                            maxDetections: 5, // Detect up to 5 people
                            scoreThreshold: 0.3
                        };

                        // Also try multi-person segmentation
                        const multiPersonSegmentation = await bodyPixModel.segmentMultiPerson(previewCanvas, multiPersonConfig);

                        // Combine masks from all detected people
                        const combinedMask = new Uint8Array(width * height);

                        // Start with the single-person mask
                        for (let i = 0; i < segmentation.data.length; i++) {
                            combinedMask[i] = segmentation.data[i];
                        }

                        // Add any additional people detected
                        if (multiPersonSegmentation.length > 0) {
                            for (const personMask of multiPersonSegmentation) {
                                for (let i = 0; i < personMask.data.length; i++) {
                                    if (personMask.data[i]) {
                                        combinedMask[i] = 1;
                                    }
                                }
                            }
                        }

                        // Create a new segmentation object with the combined mask
                        segmentationMask = {
                            data: combinedMask,
                            width: width,
                            height: height
                        };

                        // Apply advanced post-processing to improve mask quality
                        advancedMaskRefinement(segmentationMask, width, height, ctx, originalImage);

                        updatePreview();
                        showEditor();
                        loadingContainer.style.display = 'none';
                    } catch (error) {
                        console.error('Error during segmentation:', error);
                        alert('Error processing the image. Please try another one.');
                        loadingContainer.style.display = 'none';
                    }
                } else {
                    alert('Image processing model is still loading. Please try again in a moment.');
                    loadingContainer.style.display = 'none';
                }
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    }

    // Advanced mask refinement function
    function advancedMaskRefinement(mask, width, height, ctx, originalImage) {
        const maskData = mask.data;

        // Step 1: Apply morphological operations (dilation and erosion)
        const dilatedMask = new Uint8Array(maskData.length);
        const erodedMask = new Uint8Array(maskData.length);

        // Copy original mask
        for (let i = 0; i < maskData.length; i++) {
            dilatedMask[i] = maskData[i];
        }

        // Dilate the mask (expand)
        const dilationRadius = 3;
        for (let y = dilationRadius; y < height - dilationRadius; y++) {
            for (let x = dilationRadius; x < width - dilationRadius; x++) {
                const idx = y * width + x;

                if (!dilatedMask[idx]) {
                    // Check surrounding pixels in a larger radius
                    let shouldDilate = false;

                    for (let dy = -dilationRadius; dy <= dilationRadius && !shouldDilate; dy++) {
                        for (let dx = -dilationRadius; dx <= dilationRadius && !shouldDilate; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                const neighborIdx = ny * width + nx;
                                if (dilatedMask[neighborIdx]) {
                                    shouldDilate = true;
                                }
                            }
                        }
                    }

                    if (shouldDilate) {
                        maskData[idx] = 1;
                    }
                }
            }
        }

        // Copy dilated mask
        for (let i = 0; i < maskData.length; i++) {
            erodedMask[i] = maskData[i];
        }

        // Erode the mask (contract) to remove small isolated regions
        const erosionRadius = 1;
        for (let y = erosionRadius; y < height - erosionRadius; y++) {
            for (let x = erosionRadius; x < width - erosionRadius; x++) {
                const idx = y * width + x;

                if (erodedMask[idx]) {
                    // Count neighbors that are part of the subject
                    let count = 0;
                    let total = 0;

                    for (let dy = -erosionRadius; dy <= erosionRadius; dy++) {
                        for (let dx = -erosionRadius; dx <= erosionRadius; dx++) {
                            if (dx === 0 && dy === 0) continue;

                            const nx = x + dx;
                            const ny = y + dy;

                            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                total++;
                                const neighborIdx = ny * width + nx;
                                if (erodedMask[neighborIdx]) {
                                    count++;
                                }
                            }
                        }
                    }

                    // If fewer than 50% of neighbors are part of the subject, remove this pixel
                    if (count < total * 0.5) {
                        maskData[idx] = 0;
                    }
                }
            }
        }

        // Step 2: Fill holes in the mask
        fillHoles(maskData, width, height);

        // Step 3: Edge-aware refinement
        refineEdges(maskData, width, height, ctx, originalImage);
    }

    // Function to fill holes in the mask
    function fillHoles(maskData, width, height) {
        // Create a temporary mask for the flood fill
        const tempMask = new Uint8Array(maskData.length);

        // Initialize with 1s (filled) except for the edges
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;

                // Mark edges as 0
                if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
                    tempMask[idx] = 0;
                } else {
                    tempMask[idx] = 1;
                }
            }
        }

        // Flood fill from the edges
        const queue = [];

        // Start from the edges
        for (let y = 0; y < height; y++) {
            queue.push(y * width); // Left edge
            queue.push(y * width + (width - 1)); // Right edge
        }

        for (let x = 0; x < width; x++) {
            queue.push(x); // Top edge
            queue.push((height - 1) * width + x); // Bottom edge
        }

        // Perform flood fill
        while (queue.length > 0) {
            const idx = queue.shift();

            if (tempMask[idx] === 0) continue;

            tempMask[idx] = 0;

            const x = idx % width;
            const y = Math.floor(idx / width);

            // If this is background in the original mask, add neighbors to queue
            if (!maskData[idx]) {
                // Check 4-connected neighbors
                if (x > 0) queue.push(idx - 1);
                if (x < width - 1) queue.push(idx + 1);
                if (y > 0) queue.push(idx - width);
                if (y < height - 1) queue.push(idx + width);
            }
        }

        // Now tempMask contains 1s for holes and 0s for everything else
        // Fill holes in the original mask
        for (let i = 0; i < maskData.length; i++) {
            if (tempMask[i]) {
                maskData[i] = 1;
            }
        }
    }

    // Function to refine edges based on image content
    function refineEdges(maskData, width, height, ctx, originalImage) {
        // Get the original image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImage, 0, 0, width, height);
        const imageData = tempCtx.getImageData(0, 0, width, height).data;

        // Create a gradient magnitude map
        const gradientMap = new Float32Array(maskData.length);

        // Calculate gradient magnitude using Sobel operator
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                // Calculate gradient in x and y directions
                let gx = 0,
                    gy = 0;

                for (let c = 0; c < 3; c++) { // For each color channel
                    const i00 = ((y - 1) * width + (x - 1)) * 4 + c;
                    const i01 = ((y - 1) * width + x) * 4 + c;
                    const i02 = ((y - 1) * width + (x + 1)) * 4 + c;
                    const i10 = (y * width + (x - 1)) * 4 + c;
                    const i12 = (y * width + (x + 1)) * 4 + c;
                    const i20 = ((y + 1) * width + (x - 1)) * 4 + c;
                    const i21 = ((y + 1) * width + x) * 4 + c;
                    const i22 = ((y + 1) * width + (x + 1)) * 4 + c;

                    // Sobel operators
                    gx += (imageData[i02] - imageData[i00]) + 2 * (imageData[i12] - imageData[i10]) + (imageData[i22] - imageData[i20]);
                    gy += (imageData[i20] - imageData[i00]) + 2 * (imageData[i21] - imageData[i01]) + (imageData[i22] - imageData[i02]);
                }

                // Calculate gradient magnitude
                gradientMap[idx] = Math.sqrt(gx * gx + gy * gy) / 3; // Divide by 3 for the channels
            }
        }

        // Refine mask edges based on gradient
        const edgeWidth = 3;

        for (let y = edgeWidth; y < height - edgeWidth; y++) {
            for (let x = edgeWidth; x < width - edgeWidth; x++) {
                const idx = y * width + x;

                // Check if this is near an edge in the mask
                let isNearEdge = false;

                for (let dy = -edgeWidth; dy <= edgeWidth && !isNearEdge; dy++) {
                    for (let dx = -edgeWidth; dx <= edgeWidth && !isNearEdge; dx++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborIdx = ny * width + nx;

                            // If neighbor has different mask value, this is near an edge
                            if (maskData[idx] !== maskData[neighborIdx]) {
                                isNearEdge = true;
                            }
                        }
                    }
                }

                // If near an edge, refine based on gradient
                if (isNearEdge) {
                    // If high gradient, align mask edge with image edge
                    if (gradientMap[idx] > 50) { // Threshold for significant edge
                        // Check if this should be foreground or background
                        let foregroundCount = 0;
                        let backgroundCount = 0;

                        for (let dy = -2; dy <= 2; dy++) {
                            for (let dx = -2; dx <= 2; dx++) {
                                if (dx === 0 && dy === 0) continue;

                                const nx = x + dx;
                                const ny = y + dy;

                                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                                    const neighborIdx = ny * width + nx;

                                    if (maskData[neighborIdx]) {
                                        foregroundCount++;
                                    } else {
                                        backgroundCount++;
                                    }
                                }
                            }
                        }

                        // Assign to the dominant class
                        maskData[idx] = (foregroundCount > backgroundCount) ? 1 : 0;
                    }
                }
            }
        }
    }

    // Update preview with text as background
    function updatePreview() {
        if (!originalImage || !segmentationMask) return;

        const width = previewCanvas.width;
        const height = previewCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Get the text (default to "fff" if empty)
        const text = textInput.value || "fff";

        // Text settings
        const fontSizeVal = parseInt(fontSize.value);
        const fontColorVal = fontColor.value;
        const fontFamilyVal = fontFamily.value;
        const depthEffect = parseInt(textDepth.value);

        // Get text position values (convert from percentage to actual coordinates)
        const textX = width * (parseInt(textPositionX.value) / 100);
        const textY = height * (parseInt(textPositionY.value) / 100);

        // ===== LAYER 1: White Background (Bottom Layer) =====
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // ===== LAYER 2: Text Layer (Middle Layer) =====
        // Create a canvas for the text
        const textCanvas = document.createElement('canvas');
        textCanvas.width = width;
        textCanvas.height = height;
        const textCtx = textCanvas.getContext('2d');

        // Set text properties with increased size for better visibility
        textCtx.font = `bold ${fontSizeVal}px ${fontFamilyVal}`;
        textCtx.fillStyle = fontColorVal;
        textCtx.textAlign = 'center';
        textCtx.textBaseline = 'middle';

        // Draw text at the specified position
        const singleLineText = text.replace(/\n/g, ' ');

        // Draw text with a slight shadow for better visibility
        textCtx.shadowColor = 'rgba(0,0,0,0.3)';
        textCtx.shadowBlur = 3;
        textCtx.fillText(singleLineText, textX, textY);

        // Get the text image data
        const textImageData = textCtx.getImageData(0, 0, width, height);

        // ===== LAYER 3: Original Image Through Text =====
        // Create a canvas for the original image
        const originalCanvas = document.createElement('canvas');
        originalCanvas.width = width;
        originalCanvas.height = height;
        const originalCtx = originalCanvas.getContext('2d');

        // Draw the original image
        originalCtx.drawImage(originalImage, 0, 0, width, height);
        const originalImageData = originalCtx.getImageData(0, 0, width, height);

        // Create a canvas for the text-masked original image
        const maskedCanvas = document.createElement('canvas');
        maskedCanvas.width = width;
        maskedCanvas.height = height;
        const maskedCtx = maskedCanvas.getContext('2d');
        const maskedImageData = maskedCtx.createImageData(width, height);

        // Apply text as a mask to the original image
        for (let i = 0; i < width * height; i++) {
            const pixelIndex = i * 4;

            // If text exists at this pixel, show the original image
            if (textImageData.data[pixelIndex + 3] > 20) { // Lower threshold for better text visibility
                maskedImageData.data[pixelIndex] = originalImageData.data[pixelIndex];
                maskedImageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1];
                maskedImageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2];
                maskedImageData.data[pixelIndex + 3] = 255; // Fully opaque
            } else {
                // Otherwise transparent
                maskedImageData.data[pixelIndex + 3] = 0;
            }
        }

        maskedCtx.putImageData(maskedImageData, 0, 0);

        // Draw the text-masked original image
        ctx.drawImage(maskedCanvas, 0, 0);

        // ===== LAYER 4: Subject Layer (Top Layer) =====
        // Get the mask data
        const maskData = segmentationMask.data;

        // Create a canvas for the subject
        const subjectCanvas = document.createElement('canvas');
        subjectCanvas.width = width;
        subjectCanvas.height = height;
        const subjectCtx = subjectCanvas.getContext('2d');

        // Create image data for the subject with transparent background
        const subjectImageData = subjectCtx.createImageData(width, height);

        // Extract subject from original image using the mask
        for (let i = 0; i < maskData.length; i++) {
            const pixelIndex = i * 4;

            if (maskData[i]) {
                // This is the subject - copy from original image
                subjectImageData.data[pixelIndex] = originalImageData.data[pixelIndex];
                subjectImageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1];
                subjectImageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2];
                subjectImageData.data[pixelIndex + 3] = 255; // Fully opaque
            } else {
                // This is background - make transparent
                subjectImageData.data[pixelIndex + 3] = 0; // Fully transparent
            }
        }

        // Put the subject image data on the subject canvas
        subjectCtx.putImageData(subjectImageData, 0, 0);

        // Draw the subject on top
        ctx.drawImage(subjectCanvas, 0, 0);

        // Apply depth effect if needed
        if (depthEffect > 0) {
            applyLayeredDepthEffect(ctx, maskData, textImageData.data, width, height, depthEffect);
        }

        // Store current design for sharing
        currentDesignDataUrl = previewCanvas.toDataURL('image/png');
    }

    // Updated depth effect function for layered approach
    function applyLayeredDepthEffect(ctx, maskData, textData, width, height, strength) {
        // Get current canvas data
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Create a copy of the image data
        const tempData = new Uint8ClampedArray(data);

        // Create an edge detection map
        const edgeMap = new Uint8Array(maskData.length);

        // Detect edges in the mask
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;

                if (maskData[idx]) {
                    // Check if this is an edge pixel (has at least one background neighbor)
                    if (!maskData[idx - 1] || !maskData[idx + 1] ||
                        !maskData[idx - width] || !maskData[idx + width]) {
                        edgeMap[idx] = 1;
                    }
                }
            }
        }

        // Apply the enhanced depth effect
        for (let i = 0; i < maskData.length; i++) {
            if (!edgeMap[i]) continue; // Only process edge pixels

            const x = i % width;
            const y = Math.floor(i / width);
            const pixelIndex = i * 4;

            // Check surrounding pixels for text
            for (let dy = -strength; dy <= strength; dy++) {
                for (let dx = -strength; dx <= strength; dx++) {
                    if (dx === 0 && dy === 0) continue;

                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const neighborIndex = ny * width + nx;
                    const neighborPixelIndex = neighborIndex * 4;

                    // If neighbor is background with text
                    if (!maskData[neighborIndex] && textData[neighborPixelIndex + 3] > 0) {
                        // Calculate intensity based on distance
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > strength) continue;

                        const intensity = Math.pow(1 - (distance / strength), 2); // Squared for smoother falloff

                        // Apply highlight to edge with improved blending
                        const brightnessFactor = 40 * intensity;
                        data[pixelIndex] = Math.min(255, tempData[pixelIndex] + brightnessFactor);
                        data[pixelIndex + 1] = Math.min(255, tempData[pixelIndex + 1] + brightnessFactor);
                        data[pixelIndex + 2] = Math.min(255, tempData[pixelIndex + 2] + brightnessFactor);
                    }
                }
            }
        }

        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);
    }

    // Download the edited image
    function downloadImage() {
        if (!currentDesignDataUrl) {
            updatePreview(); // Make sure we have the latest version
        }

        const link = document.createElement('a');
        link.download = 'textbimg_design.png';
        link.href = currentDesignDataUrl;
        link.click();
    }

    // Share the edited image
    function shareImage() {
        if (!currentDesignDataUrl) {
            updatePreview(); // Make sure we have the latest version
        }

        if (navigator.share) {
            // Web Share API is supported
            fetch(currentDesignDataUrl)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], 'textbimg_design.png', { type: 'image/png' });
                    navigator.share({
                        title: 'My TextBIMG Design',
                        text: 'Check out this text-behind-image design I created with TextBIMG!',
                        files: [file]
                    }).catch(error => {
                        console.error('Error sharing:', error);
                        fallbackShare();
                    });
                });
        } else {
            fallbackShare();
        }
    }

    // Fallback sharing method
    function fallbackShare() {
        // Create a temporary input
        const input = document.createElement('input');
        input.value = 'Check out TextBIMG for creating text-behind-image designs: https://textbimg.netlify.app';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);

        alert('Link copied to clipboard! You can paste it to share with others.');
    }

    // Initialize gallery items
    const galleryItems = document.querySelectorAll('.gallery-item');
    galleryItems.forEach(item => {
        item.addEventListener('click', () => {
            // In a real app, you might load the selected gallery image
            alert('Gallery feature coming soon! You\'ll be able to use these example images as templates.');
        });
    });
});