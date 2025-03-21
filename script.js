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
    textDensity.addEventListener('input', () => {
        textDensityValue.textContent = textDensity.value;
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
        textDensity.value = 5;
        textDensityValue.textContent = '5';
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

                // Process image with BodyPix
                if (bodyPixModel) {
                    try {
                        segmentationMask = await bodyPixModel.segmentPerson(previewCanvas);
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

    // Update preview with text as background
    function updatePreview() {
        if (!originalImage || !segmentationMask) return;

        const width = previewCanvas.width;
        const height = previewCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        const text = textInput.value;
        if (!text) {
            // If no text, just show original image
            ctx.drawImage(originalImage, 0, 0, width, height);
            return;
        }

        // Text settings
        const fontSizeVal = parseInt(fontSize.value);
        const fontColorVal = fontColor.value;
        const fontFamilyVal = fontFamily.value;
        const depthEffect = parseInt(textDepth.value);
        const density = parseInt(textDensity.value);

        // Create temporary canvas for background pattern
        const patternCanvas = document.createElement('canvas');
        patternCanvas.width = width;
        patternCanvas.height = height;
        const patternCtx = patternCanvas.getContext('2d');

        // Draw original image on pattern canvas (to extract background)
        patternCtx.drawImage(originalImage, 0, 0, width, height);

        // Create text pattern canvas
        const textPatternCanvas = document.createElement('canvas');
        textPatternCanvas.width = width;
        textPatternCanvas.height = height;
        const textPatternCtx = textPatternCanvas.getContext('2d');

        // Set text properties
        textPatternCtx.font = `${fontSizeVal}px ${fontFamilyVal}`;
        textPatternCtx.fillStyle = fontColorVal;
        textPatternCtx.textAlign = 'center';
        textPatternCtx.textBaseline = 'middle';

        // Use only a single line of text (ignore line breaks)
        const singleLineText = text.replace(/\n/g, ' ');

        // Calculate text metrics for spacing
        const textMetrics = textPatternCtx.measureText(singleLineText);
        const textWidth = textMetrics.width;

        // Calculate rows and columns for text pattern
        const horizontalSpacing = textWidth + fontSizeVal * 0.5;
        const verticalSpacing = fontSizeVal * (1.2 * (10 / density));

        const cols = Math.ceil(width / horizontalSpacing) + 2;
        const rows = Math.ceil(height / verticalSpacing) + 2;

        // Fill the canvas with a grid of text
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                // Offset every other row for a more natural pattern
                const xOffset = (row % 2) * (horizontalSpacing / 2);
                const x = col * horizontalSpacing + xOffset - horizontalSpacing / 2;
                const y = row * verticalSpacing - verticalSpacing / 2;

                textPatternCtx.fillText(singleLineText, x, y);
            }
        }

        // Get image data
        const originalImageData = patternCtx.getImageData(0, 0, width, height);
        const textImageData = textPatternCtx.getImageData(0, 0, width, height);
        const maskData = segmentationMask.data;
        const resultImageData = ctx.createImageData(width, height);

        // Combine background text with foreground subject
        for (let i = 0; i < maskData.length; i++) {
            const pixelIndex = i * 4;

            if (maskData[i]) {
                // This is the subject (person) - keep it from original image
                resultImageData.data[pixelIndex] = originalImageData.data[pixelIndex];
                resultImageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1];
                resultImageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2];
                resultImageData.data[pixelIndex + 3] = 255; // Full opacity
            } else {
                // This is background - use text pattern where text exists
                if (textImageData.data[pixelIndex + 3] > 0) {
                    // Where text exists, show original background behind text
                    resultImageData.data[pixelIndex] = originalImageData.data[pixelIndex];
                    resultImageData.data[pixelIndex + 1] = originalImageData.data[pixelIndex + 1];
                    resultImageData.data[pixelIndex + 2] = originalImageData.data[pixelIndex + 2];
                    resultImageData.data[pixelIndex + 3] = 255;
                } else {
                    // Where no text, make transparent or use a fill color
                    resultImageData.data[pixelIndex] = 255;
                    resultImageData.data[pixelIndex + 1] = 255;
                    resultImageData.data[pixelIndex + 2] = 255;
                    resultImageData.data[pixelIndex + 3] = 0; // Transparent
                }
            }

            // Apply depth effect around subject edges
            if (maskData[i]) {
                // Check surrounding pixels for background
                const x = i % width;
                const y = Math.floor(i / width);

                // Apply shadow/glow effect at the edges
                const edgeSize = depthEffect;
                let isEdge = false;

                // Check if this is an edge pixel
                for (let dx = -edgeSize; dx <= edgeSize && !isEdge; dx++) {
                    for (let dy = -edgeSize; dy <= edgeSize && !isEdge; dy++) {
                        if (dx === 0 && dy === 0) continue;

                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborIndex = ny * width + nx;
                            if (!maskData[neighborIndex] && textImageData.data[neighborIndex * 4 + 3] > 0) {
                                isEdge = true;

                                // Enhance edge with glow effect
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                const intensity = 1 - (distance / edgeSize);

                                if (intensity > 0) {
                                    resultImageData.data[pixelIndex] = Math.min(255, resultImageData.data[pixelIndex] + 50 * intensity);
                                    resultImageData.data[pixelIndex + 1] = Math.min(255, resultImageData.data[pixelIndex + 1] + 50 * intensity);
                                    resultImageData.data[pixelIndex + 2] = Math.min(255, resultImageData.data[pixelIndex + 2] + 50 * intensity);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Put the modified image data back
        ctx.putImageData(resultImageData, 0, 0);

        // Store current design for sharing
        currentDesignDataUrl = previewCanvas.toDataURL('image/png');
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