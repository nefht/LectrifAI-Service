function cleanMarkdown(text) {
  if (!text) return "";

  // Xóa các ký tự markdown phổ biến
  return (
    text
      // Bôi đậm hoặc in nghiêng: **bold**, *italic*, __bold__, _italic_
      .replace(/(\*{1,2}|_{1,2})(.*?)$/gm, "$2") // xử lý markdown không có dấu kết thúc
      .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, "$2")
      // Gạch đầu dòng hoặc số thứ tự
      .replace(/^(\s*)[-*+] /gm, "")
      .replace(/^(\s*)\d+\.\s+/gm, "")
      // Link markdown [text](url)
      .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
      // Xử lý các header #, ##, ###,...
      .replace(/^#{1,6}\s*/gm, "")
      // Code block ```js
      .replace(/```[\s\S]*?```/g, "")
      // Inline code `code`
      .replace(/`([^`]+)`/g, "$1")
      // Xóa > trích dẫn
      .replace(/^>\s?/gm, "")
      // Xóa khoảng trắng dư
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

module.exports = {
  cleanMarkdown,
};