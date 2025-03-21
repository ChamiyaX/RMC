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

    // Reset button
    resetBtn.addEventListener('click', () => {
        textInput.value = '';
        fontSize.value = 40;
        fontSizeValue.textContent = '40px';
        fontColor.value = '#ffffff';
        fontFamily.value = 'Arial';
        textDepth.value = 5;
        textDepthValue.textContent = '5';
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

    // Update preview with text behind subject
    function updatePreview() {
        if (!originalImage || !segmentationMask) return;

        const width = previewCanvas.width;
        const height = previewCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw original image
        ctx.drawImage(originalImage, 0, 0, width, height);

        const text = textInput.value;
        if (!text) return;

        // Text settings
        const fontSizeVal = parseInt(fontSize.value);
        const fontColorVal = fontColor.value;
        const fontFamilyVal = fontFamily.value;
        const depthEffect = parseInt(textDepth.value);

        ctx.font = `${fontSizeVal}px ${fontFamilyVal}`;
        ctx.fillStyle = fontColorVal;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Create temporary canvas for text
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');

        // Draw text on temporary canvas
        tempCtx.font = ctx.font;
        tempCtx.fillStyle = ctx.fillStyle;
        tempCtx.textAlign = ctx.textAlign;
        tempCtx.textBaseline = ctx.textBaseline;

        // Calculate text position
        const lines = text.split('\n');
        const lineHeight = fontSizeVal * 1.2;
        const totalTextHeight = lineHeight * lines.length;
        let startY = (height - totalTextHeight) / 2 + lineHeight / 2;

        // Draw text on temp canvas
        lines.forEach((line, index) => {
            const y = startY + index * lineHeight;
            tempCtx.fillText(line, width / 2, y);
        });

        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const textImageData = tempCtx.getImageData(0, 0, width, height);
        const maskData = segmentationMask.data;

        // Apply depth effect - place text behind subject
        for (let i = 0; i < maskData.length; i++) {
            const pixelIndex = i * 4;

            // If pixel is not part of a person (background)
            if (!maskData[i]) {
                // Check if there's text at this pixel
                if (textImageData.data[pixelIndex + 3] > 0) {
                    // Apply text to background
                    imageData.data[pixelIndex] = textImageData.data[pixelIndex];
                    imageData.data[pixelIndex + 1] = textImageData.data[pixelIndex + 1];
                    imageData.data[pixelIndex + 2] = textImageData.data[pixelIndex + 2];

                    // Apply depth effect (shadow)
                    const shadowOffset = depthEffect;
                    const shadowIndex = ((i % width) + shadowOffset + (Math.floor(i / width) + shadowOffset) * width) * 4;

                    if (shadowIndex < imageData.data.length && maskData[Math.floor(shadowIndex / 4)]) {
                        // Add shadow to person edges for depth effect
                        const shadowAlpha = 0.3;
                        imageData.data[shadowIndex] = (imageData.data[shadowIndex] * (1 - shadowAlpha) + 0 * shadowAlpha);
                        imageData.data[shadowIndex + 1] = (imageData.data[shadowIndex + 1] * (1 - shadowAlpha) + 0 * shadowAlpha);
                        imageData.data[shadowIndex + 2] = (imageData.data[shadowIndex + 2] * (1 - shadowAlpha) + 0 * shadowAlpha);
                    }
                }
            }
        }

        // Put the modified image data back
        ctx.putImageData(imageData, 0, 0);
    }

    // Download the edited image
    function downloadImage() {
        const link = document.createElement('a');
        link.download = 'textbimg_edited.png';
        link.href = previewCanvas.toDataURL('image/png');
        link.click();
    }
});