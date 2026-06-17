import React, { useEffect, useState } from "react";
import "./App.css";

const App = () => {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/books.json")
      .then((response) => response.json())
      .then((data) => setBooks(data))
      .catch((error) => console.error("Error fetching books:", error));
  }, []);

  const filteredBooks = books.filter((book) =>
    book.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container">
      <img
        src="https://banner2.cleanpng.com/20240112/hei/transparent-library-library-books-magazines-newspapers-library-building-with-wooden-facade-glass-1710925442010.webp"
        alt="Logo"
        style={{ width: "100px", height: "100px" }}
      />

      <h1>Digital BookStore</h1>
      <input
        type="text"
        placeholder="Search books..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="book-grid">
        {filteredBooks.map((book, index) => (
          <div key={index} className="book-card">
            <img
              src={
                book.img ||
                "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcToFFi0QNMGlot9SjmSF6jc0icuk_dTuphWDA&s"
              }
              alt={book.title}
            />
            <h2>{book.title}</h2>
            <p>
              <strong>Author:</strong> {book.author || "Unknown"}
            </p>
            <p>
              <strong>Language:</strong> {book.language || "Unknown"}
            </p>
            <a href={book.pdf} target="_blank" rel="noopener noreferrer">
              📖 Read Book
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
