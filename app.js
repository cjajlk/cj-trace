console.log("CJ Trace démarré");

const imagePicker =
    document.getElementById("imagePicker");

const chooseImage =
    document.getElementById("chooseImage");

const changeImage =
    document.getElementById("changeImage");

const previewImage =
    document.getElementById("previewImage");

const homeScreen =
    document.getElementById("homeScreen");

const previewScreen =
    document.getElementById("previewScreen");

const startAR =
    document.getElementById("startAR");

const status =
    document.getElementById("status");


let selectedImage = null;


/* ==============================
   CHOISIR UNE IMAGE
================================ */

chooseImage.addEventListener("click", () => {
    imagePicker.click();
});


changeImage.addEventListener("click", () => {
    imagePicker.click();
});


imagePicker.addEventListener("change", event => {

    const file = event.target.files[0];

    if (!file) {
        return;
    }

    if (!file.type.startsWith("image/")) {

        status.textContent =
            "Ce fichier n'est pas une image.";

        return;
    }


    if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
    }


    selectedImage =
        URL.createObjectURL(file);


    previewImage.src =
        selectedImage;


    homeScreen.classList.add("hidden");

    previewScreen.classList.remove("hidden");


    status.textContent =
        "Image prête pour le mode AR.";

});


/* ==============================
   BOUTON COMMENCER
================================ */

startAR.addEventListener("click", async () => {

    if (!selectedImage) {

        status.textContent =
            "Choisis d'abord une image.";

        return;
    }


    if (!navigator.xr) {

        status.textContent =
            "WebXR n'est pas disponible sur cet appareil.";

        return;
    }


    try {

        const supported =
            await navigator.xr.isSessionSupported(
                "immersive-ar"
            );


        if (!supported) {

            status.textContent =
                "Le mode AR immersif n'est pas disponible ici.";

            return;
        }


        status.textContent =
            "Ouverture du mode AR...";


        await startARSession();


    } catch (error) {

        console.error(error);

        status.textContent =
            "Impossible de lancer le mode AR.";

    }

});


/* ==============================
   SESSION WEBXR
================================ */

async function startARSession() {

    let session = null;

    try {

        /*
          La demande doit rester directement liée au clic.
          Wolvic peut refuser immersive-ar si un chargement
          asynchrone est effectué avant requestSession().
        */

        session = await navigator.xr.requestSession(
            "immersive-ar",
            {
                optionalFeatures: [
                    "local-floor",
                    "bounded-floor",
                    "hand-tracking"
                ]
            }
        );

    /*
      SCÈNE THREE.JS
    */

    const scene =
        new THREE.Scene();


    /*
      CAMÉRA XR
    */

    const camera =
        new THREE.PerspectiveCamera(
            70,
            window.innerWidth /
            window.innerHeight,
            0.01,
            100
        );


    /*
      RENDERER TRANSPARENT

      Important pour laisser
      apparaître le passthrough.
    */

    const renderer =
        new THREE.WebGLRenderer({
            alpha: true,
            antialias: true
        });


    renderer.setPixelRatio(
        window.devicePixelRatio
    );


    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );


    renderer.xr.enabled = true;


    /*
      L'espace "local" permet
      aux objets de rester
      positionnés dans la pièce
      au lieu de suivre la tête.
    */

    renderer.xr.setReferenceSpaceType(
        "local"
    );


    /*
      CHARGEMENT DU DESSIN
    */

    const textureLoader =
        new THREE.TextureLoader();


    const texture =
        await textureLoader.loadAsync(
            selectedImage
        );


    texture.colorSpace =
        THREE.SRGBColorSpace;


    /*
      CALCUL DU FORMAT ORIGINAL
      DE L'IMAGE
    */

    const imageWidth =
        texture.image.width;

    const imageHeight =
        texture.image.height;


    const ratio =
        imageWidth / imageHeight;


    /*
      On donne environ
      80 cm de hauteur au dessin
      pour notre premier test.
    */

    const planeHeight = 0.8;

    const planeWidth =
        planeHeight * ratio;


    const geometry =
        new THREE.PlaneGeometry(
            planeWidth,
            planeHeight
        );


    /*
      40 % D'OPACITÉ
    */

    const material =
        new THREE.MeshBasicMaterial({

            map: texture,

            transparent: true,

            opacity: 0.4,

            side: THREE.DoubleSide

        });


    const drawing =
        new THREE.Mesh(
            geometry,
            material
        );


    /*
      POSITION INITIALE

      Centré à hauteur du regard,
      1,50 m devant nous.
    */

    drawing.position.set(
        0,
        0,
        -1.5
    );


    scene.add(drawing);


    await renderer.xr.setSession(
        session
    );


    /*
      BOUCLE DE RENDU
    */

    renderer.setAnimationLoop(() => {

        renderer.render(
            scene,
            camera
        );

    });


    /*
      FIN DE SESSION
    */

    session.addEventListener(
        "end",
        () => {

            renderer.setAnimationLoop(
                null
            );


            renderer.dispose();


            status.textContent =
                "Mode AR fermé.";

        }
    );

    } catch (error) {

        if (session) {
            await session.end().catch(() => {});
        }

        throw error;

    }

}
