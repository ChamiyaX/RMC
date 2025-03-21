document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const imageUpload = document.getElementById('imageUpload');
    const editorContainer = document.getElementById('editorContainer');
    const previewCanvas = document.getElementById('previewCanvas');
    const textInput = document.getElementById('textInput');
    const fontSize = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const fontColor = document.getElementById('fontColor');
    const fontFamily = document.getElementById('fontFamily');
    const textDepth = document.getElementById('textDepth');
    const textDepthValue = document.getElementById('textDepthValue');
    const resetBtn = document.getElementById('resetBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const loadingContainer = document.getElementById('loadingContainer');
    const textDensity = document.getElementById('textDensity');
    const textDensityValue = document.getElementById('textDensityValue');

    // Canvas context
    const ctx = previewCanvas.getContext('2d');

    // Variables to store image and segmentation data
    let originalImage = null;
    let segmentationMask = null;
    let bodyPixModel = null;

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
                        editorContainer.style.display = 'flex';
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

        // Adjust the textSpacing based on density
        const textSpacing = fontSizeVal * (1.5 / (density / 5));

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

        // Calculate text position and create text pattern
        const lines = text.split('\n');
        const lineHeight = fontSizeVal * 1.2;
        const totalTextHeight = lineHeight * lines.length;
        let startY = (height - totalTextHeight) / 2 + lineHeight / 2;

        // Fill the entire canvas with repeating text
        const horizontalRepeats = Math.ceil(width / (fontSizeVal * 5)) + 1;
        const verticalRepeats = Math.ceil(height / textSpacing) + 1;

        for (let v = 0; v < verticalRepeats; v++) {
            for (let h = 0; h < horizontalRepeats; h++) {
                lines.forEach((line, index) => {
                    const x = (h * fontSizeVal * 5) % (width + fontSizeVal * 5) - fontSizeVal;
                    const y = (v * totalTextHeight + index * lineHeight) % (height + totalTextHeight) - fontSizeVal;
                    textPatternCtx.fillText(line, x, y);
                });
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
    }

    // Download the edited image
    function downloadImage() {
        const link = document.createElement('a');
        link.download = 'textbimg_edited.png';
        link.href = previewCanvas.toDataURL('image/png');
        link.click();
    }
});