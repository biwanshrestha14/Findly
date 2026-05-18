import math
import re
from collections import Counter

def tokenize(text):
    """
    Basic tokenization: converts text to lowercase, strips punctuation, 
    and splits into a list of words.
    """
    text = text.lower()
    # Remove all non-word characters and non-whitespace characters
    text = re.sub(r'[^\w\s]', '', text)
    return text.split()

def compute_tf(word_counts, total_words):
    """
    Term Frequency (TF)
    Calculates the frequency of a word in a specific document relative to total words.
    Formula: (Frequency of term in doc) / (Total words in doc)
    """
    tf = {}
    for word, count in word_counts.items():
        tf[word] = count / total_words
    return tf

def compute_idf(documents):
    """
    Inverse Document Frequency (IDF)
    Measures how much information a word provides across the entire corpus.
    We mirror the scikit-learn smoothing formula: log((1 + N) / (1 + df)) + 1
    This prevents zero divisions and zero weights for words shared in both documents.
    """
    n_samples = len(documents)
    
    # Track Document Frequency (df) - how many documents contain the word
    word_doc_counts = Counter()
    for doc in documents:
        unique_words = set(doc)
        for word in unique_words:
            word_doc_counts[word] += 1
            
    idf = {}
    for word, df in word_doc_counts.items():
        idf[word] = math.log((1 + n_samples) / (1 + df)) + 1.0
    return idf

def compute_tfidf(tf, idf):
    """
    Multiplies Term Frequency by Inverse Document Frequency.
    """
    tfidf = {}
    for word, tf_val in tf.items():
        tfidf[word] = tf_val * idf.get(word, 0)
    return tfidf

def calculate_cosine_similarity(vec1, vec2):
    """
    Cosine Similarity Calculator
    Formula: (A · B) / (||A|| * ||B||)
    Calculates the geometric cosine angle between two multi-dimensional TF-IDF vectors.
    """
    # Find words present in both vectors to compute the dot product
    intersection = set(vec1.keys()) & set(vec2.keys())
    
    # 1. Calculate Dot Product (A · B)
    dot_product = sum([vec1[x] * vec2[x] for x in intersection])
    
    # 2. Calculate Magnitudes (Euclidean norms: ||A|| and ||B||)
    mag1 = math.sqrt(sum([val**2 for val in vec1.values()]))
    mag2 = math.sqrt(sum([val**2 for val in vec2.values()]))
    
    if mag1 == 0 or mag2 == 0:
        return 0.0
        
    # 3. Final Cosine Ratio
    return dot_product / (mag1 * mag2)

def compute_custom_text_similarity(text1, text2):
    """
    End-to-end processing pipeline implementing TF-IDF vectorization 
    and Cosine Similarity entirely from scratch.
    """
    if not text1.strip() or not text2.strip():
        return 0.0
        
    tokens1 = tokenize(text1)
    tokens2 = tokenize(text2)
    
    if not tokens1 or not tokens2:
        return 0.0
        
    counts1 = Counter(tokens1)
    counts2 = Counter(tokens2)
    
    tf1 = compute_tf(counts1, len(tokens1))
    tf2 = compute_tf(counts2, len(tokens2))
    
    # Our corpus consists of the two items being compared
    documents = [tokens1, tokens2]
    idf = compute_idf(documents)
    
    tfidf1 = compute_tfidf(tf1, idf)
    tfidf2 = compute_tfidf(tf2, idf)
    
    similarity = calculate_cosine_similarity(tfidf1, tfidf2)
    return float(similarity)
