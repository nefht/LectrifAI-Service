const Notebook = require("../models/Notebook");

class NotebookController {
  // [GET] /notebook
  async getNotebooks(req, res, next) {
    try {
      const userId = req.user.id;

      const notebooks = await Notebook.find({ userId }).sort({ createdAt: -1 });

      res.status(200).json(notebooks);
    } catch (error) {
      next(error);
    }
  }

  // [GET] /notebook/:lectureId
  async getNotebookByLectureId(req, res, next) {
    try {
      const { lectureId } = req.params;
      const userId = req.user.id;

      const notebook = await Notebook.findOne({
        lectureId,
        userId,
      });

      if (!notebook) {
        return res.status(404).json({ error: "Notebook not found." });
      }

      res.status(200).json(notebook);
    } catch (error) {
      next(error);
    }
  }

  // [POST] /notebook - Create or get notebook
  async createOrGetNotebook(req, res, next) {
    try {
      const { lectureId } = req.body;
      const userId = req.user.id;

      if (!lectureId) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      let notebook = await Notebook.findOne({ lectureId, userId });

      if (!notebook) {
        notebook = new Notebook({ lectureId, userId, content: { blocks: [] } });
        await notebook.save();
      }

      res.status(200).json(notebook);
    } catch (error) {
      next(error);
    }
  }

  // [PUT] /notebook/:lectureId
  async updateNotebook(req, res, next) {
    try {
      const { lectureId } = req.params;
      const { content } = req.body;
      const userId = req.user.id;

      if (!content) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      const notebook = await Notebook.findOne({ lectureId, userId });
      if (!notebook) {
        return res.status(404).json({ error: "Notebook not found." });
      }

      notebook.content = content;
      await notebook.save();

      res.status(200).json({ message: "Notebook updated successfully." });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotebookController();