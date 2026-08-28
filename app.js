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

    /* ==============================
   CONTROLEUR PICO
================================ */

const controller =
    renderer.xr.getController(0);

scene.add(controller);


/*
   Petit rayon visible depuis
   la manette pour viser le dessin
*/

const rayGeometry =
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -3)
    ]);

const rayMaterial =
    new THREE.LineBasicMaterial({
        color: 0xffffff
    });

const controllerRay =
    new THREE.Line(
        rayGeometry,
        rayMaterial
    );

controller.add(controllerRay);


/*
   Outils pour déplacer l'image
*/

const raycaster =
    new THREE.Raycaster();

const tempMatrix =
    new THREE.Matrix4();

const rayOrigin =
    new THREE.Vector3();

const rayDirection =
    new THREE.Vector3();

const grabOffset =
    new THREE.Vector3();

let isDragging = false;

let grabDistance = 1.5;


/*
   Calcule le rayon qui part
   de la manette PICO
*/

function updateControllerRay() {

    tempMatrix.identity().extractRotation(
        controller.matrixWorld
    );

    rayOrigin.setFromMatrixPosition(
        controller.matrixWorld
    );

    rayDirection
        .set(0, 0, -1)
        .applyMatrix4(tempMatrix)
        .normalize();

    raycaster.ray.origin.copy(
        rayOrigin
    );

    raycaster.ray.direction.copy(
        rayDirection
    );

}


/* ==============================
   GACHETTE : SAISIR
================================ */

controller.addEventListener(
    "selectstart",
    () => {

        updateControllerRay();

        const intersections =
            raycaster.intersectObject(
                drawing,
                false
            );

        if (intersections.length === 0) {
            return;
        }


        isDragging = true;


        /*
          Distance entre la manette
          et le point visé sur l'image
        */

        grabDistance =
            intersections[0].distance;


        /*
          Permet de saisir l'image
          exactement à l'endroit
          où on l'a attrapée
        */

        const targetPoint =
            rayOrigin
                .clone()
                .add(
                    rayDirection
                        .clone()
                        .multiplyScalar(
                            grabDistance
                        )
                );

        grabOffset
            .copy(drawing.position)
            .sub(targetPoint);

    }
);


/* ==============================
   RELACHER
================================ */

controller.addEventListener(
    "selectend",
    () => {

        isDragging = false;

    }
);


    await renderer.xr.setSession(
        session
    );


    /*
      BOUCLE DE RENDU
    */

    /* ==============================
   BOUCLE DE RENDU XR
================================ */

let previousTime =
    performance.now();


renderer.setAnimationLoop(() => {

    const now =
        performance.now();

    const delta =
        Math.min(
            (now - previousTime) / 1000,
            0.1
        );

    previousTime = now;


    /* --------------------------
       DEPLACEMENT
    --------------------------- */

    updateControllerRay();


    if (isDragging) {

        const newPosition =
            rayOrigin
                .clone()
                .add(
                    rayDirection
                        .clone()
                        .multiplyScalar(
                            grabDistance
                        )
                )
                .add(grabOffset);


        drawing.position.copy(
            newPosition
        );

    }


    /* --------------------------
       JOYSTICK = TAILLE
    --------------------------- */

    for (
        const inputSource
        of session.inputSources
    ) {

        if (
            inputSource.targetRayMode
                !== "tracked-pointer"
        ) {
            continue;
        }


        const gamepad =
            inputSource.gamepad;


        if (!gamepad) {
            continue;
        }


        const axes =
            gamepad.axes;


        if (
            !axes ||
            axes.length < 2
        ) {
            continue;
        }


        /*
          On prend l'axe vertical
          du dernier stick disponible.

          Cela permet d'être assez
          tolérant avec le mapping PICO.
        */

        const stickY =
            axes[axes.length - 1];


        const deadZone = 0.25;


        if (
            Math.abs(stickY)
            > deadZone
        ) {

            /*
              Stick vers le haut :
              agrandir

              Stick vers le bas :
              réduire
            */

            let scale =
                drawing.scale.x;


            scale +=
                (-stickY)
                * delta
                * 0.8;


            /*
              On empêche une taille
              ridicule ou gigantesque.
            */

            scale =
                THREE.MathUtils.clamp(
                    scale,
                    0.15,
                    5
                );


            drawing.scale.set(
                scale,
                scale,
                scale
            );

        }

        break;

    }


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
