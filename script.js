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

        // Get the text (default to "fff" if empty)
        const text = textInput.value || "fff";

        // Text settings
        const fontSizeVal = parseInt(fontSize.value);
        const fontColorVal = fontColor.value;
        const fontFamilyVal = fontFamily.value;
        const depthEffect = parseInt(textDepth.value);

        // Create a background canvas with white background
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = width;
        bgCanvas.height = height;
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.fillStyle = '#ffffff';
        bgCtx.fillRect(0, 0, width, height);

        // Create a text canvas
        const textCanvas = document.createElement('canvas');
        textCanvas.width = width;
        textCanvas.height = height;
        const textCtx = textCanvas.getContext('2d');

        // Set text properties
        textCtx.font = `${fontSizeVal}px ${fontFamilyVal}`;
        textCtx.fillStyle = fontColorVal;
        textCtx.textAlign = 'center';
        textCtx.textBaseline = 'middle';

        // Draw a single large text in the center
        const singleLineText = text.replace(/\n/g, ' ');
        textCtx.fillText(singleLineText, width / 2, height / 2);

        // Get the mask data
        const maskData = segmentationMask.data;

        // Create the final image data
        const finalImageData = ctx.createImageData(width, height);

        // Draw the original image to a temporary canvas to get its pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(originalImage, 0, 0, width, height);
        const originalImageData = tempCtx.getImageData(0, 0, width, height).data;

        // Get text pixel data
        const textImageData = textCtx.getImageData(0, 0, width, height).data;

        // Process each pixel
        for (let i = 0; i < maskData.length; i++) {
            const pixelIndex = i * 4;

            // Start with white background
            finalImageData.data[pixelIndex] = 255; // R
            finalImageData.data[pixelIndex + 1] = 255; // G
            finalImageData.data[pixelIndex + 2] = 255; // B
            finalImageData.data[pixelIndex + 3] = 255; // A

            if (maskData[i]) {
                // This is the subject - keep original image
                finalImageData.data[pixelIndex] = originalImageData[pixelIndex];
                finalImageData.data[pixelIndex + 1] = originalImageData[pixelIndex + 1];
                finalImageData.data[pixelIndex + 2] = originalImageData[pixelIndex + 2];
            } else if (textImageData[pixelIndex + 3] > 0) {
                // This is background with text - show original image
                finalImageData.data[pixelIndex] = originalImageData[pixelIndex];
                finalImageData.data[pixelIndex + 1] = originalImageData[pixelIndex + 1];
                finalImageData.data[pixelIndex + 2] = originalImageData[pixelIndex + 2];
            }
        }

        // Apply depth effect if needed
        if (depthEffect > 0) {
            applyDepthEffect(finalImageData, maskData, textImageData, width, height, depthEffect);
        }

        // Put the final image data to the canvas
        ctx.putImageData(finalImageData, 0, 0);

        // Store current design for sharing
        currentDesignDataUrl = previewCanvas.toDataURL('image/png');
    }

    // Helper function to apply depth effect
    function applyDepthEffect(imageData, maskData, textImageData, width, height, strength) {
        const edgeSize = strength;

        // Create a copy of the image data to avoid modifying while iterating
        const tempData = new Uint8ClampedArray(imageData.data);

        for (let i = 0; i < maskData.length; i++) {
            if (!maskData[i]) continue; // Skip non-subject pixels

            const x = i % width;
            const y = Math.floor(i / width);
            const pixelIndex = i * 4;

            // Check surrounding pixels for text in background
            for (let dx = -edgeSize; dx <= edgeSize; dx++) {
                for (let dy = -edgeSize; dy <= edgeSize; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const nx = x + dx;
                    const ny = y + dy;

                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const neighborIndex = ny * width + nx;

                    // If neighbor is background with text
                    if (!maskData[neighborIndex] && textImageData[neighborIndex * 4 + 3] > 0) {
                        // Calculate intensity based on distance
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > edgeSize) continue;

                        const intensity = 1 - (distance / edgeSize);

                        // Apply highlight to edge
                        const brightnessFactor = 30 * intensity;
                        imageData.data[pixelIndex] = Math.min(255, tempData[pixelIndex] + brightnessFactor);
                        imageData.data[pixelIndex + 1] = Math.min(255, tempData[pixelIndex + 1] + brightnessFactor);
                        imageData.data[pixelIndex + 2] = Math.min(255, tempData[pixelIndex + 2] + brightnessFactor);
                    }
                }
            }
        }
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