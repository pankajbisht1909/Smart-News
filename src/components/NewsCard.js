import React from "react";

const NewsCard = ({ articles }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "20px",
        padding: "20px",
      }}
    >
      {articles.map((article, index) => {
        const {
          title,
          description,
          image,
          url,
          publishedAt,
          content,
          source,
          topic,
        } = article;

        const publisher =
          typeof article.publisher === "string"
            ? article.publisher
            : source?.name || "Unknown";

        return (
          <div
            key={index}
            style={{
              background: "#fff",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {image && (
              <img
                src={image}
                alt={title}
                style={{ width: "100%", height: "180px", objectFit: "cover" }}
              />
            )}
            <div style={{ padding: "16px" }}>
              <h3 style={{ fontSize: "18px", color: "#333" }}>
                {title || "No title"}
              </h3>
              <p style={{ fontSize: "14px", color: "#666" }}>
                {description || content || "No description"}
              </p>
              <p style={{ fontSize: "14px", color: "#888" }}>
                <strong>Publisher:</strong> {publisher}
              </p>
              <p style={{ fontSize: "12px", color: "#aaa" }}>
                <strong>Published At:</strong>{" "}
                {publishedAt
                  ? new Date(publishedAt).toLocaleString()
                  : "Unknown"}
              </p>
              <p style={{ fontSize: "12px", color: "#aaa" }}>
                <strong>Topic:</strong> {topic || "Not specified"}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: "10px",
                  display: "inline-block",
                  color: "#007bff",
                }}
              >
                Read More
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NewsCard;
