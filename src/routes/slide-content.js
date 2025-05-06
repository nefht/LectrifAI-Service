const express = require("express");
const router = express.Router();

const generatedSlideController = require("../app/controllers/SlideContentController");
const { verifyToken } = require("../app/middleware/authMiddleware");
const {
  validateSlideRequestV1,
  validateSlideRequestV2,
  validateSlideRequestV3,
  validateUpdateSlideContent,
} = require("../app/middleware/slideContentMiddleware");

router.get("/image-proxy", generatedSlideController.getImageProxy);
router.get("/:id", verifyToken, generatedSlideController.getSlideContentById);
router.get("/", verifyToken, generatedSlideController.getSlideContents);
router.post(
  "/v1",
  verifyToken,
  validateSlideRequestV1,
  generatedSlideController.createSlideContentV1
);

router.post(
  "/v2",
  verifyToken,
  validateSlideRequestV2,
  generatedSlideController.createSlideContentV2
);

router.post(
  "/v3",
  verifyToken,
  validateSlideRequestV3,
  generatedSlideController.createSlideContentV3
);

router.delete("/:id", verifyToken, generatedSlideController.deleteSlideContent);

router.patch(
  "/:id",
  verifyToken,
  validateUpdateSlideContent,
  generatedSlideController.updateSlideContent
);

module.exports = router;
