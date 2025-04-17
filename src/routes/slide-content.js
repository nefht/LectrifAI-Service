const express = require("express");
const router = express.Router();

const generatedSlideController = require("../app/controllers/SlideContentController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateSlideRequest,
} = require("../app/middleware/slideContentMiddleware");

router.get(
  "/image-proxy",
  generatedSlideController.getImageProxy
);
router.get("/:id", verifyToken, generatedSlideController.getSlideContentById);
router.get("/", verifyToken, generatedSlideController.getSlideContents);
router.post(
  "/v1",
  verifyToken,
  validateSlideRequest,
  generatedSlideController.createSlideContentV1
);

router.post(
  "/v2",
  verifyToken,
  validateSlideRequest,
  generatedSlideController.createSlideContentV2
);

router.patch(
  "/:id",
  verifyToken,
  generatedSlideController.updateSlideContent
)

module.exports = router;
