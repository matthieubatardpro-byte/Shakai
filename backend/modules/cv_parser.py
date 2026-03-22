import fitz
import docx
import os
import re

def extract_text_from_pdf(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text

def extract_cv_info(text):
    email = re.findall(r'[\w.-]+@[\w.-]+\.\w+', text)
    phone = re.findall(r'[\+\(]?[0-9][0-9\s\-\(\)]{8,}[0-9]', text)
    
    skills_keywords = [
        "python", "javascript", "react", "node", "sql", "java",
        "html", "css", "git", "docker", "fastapi", "excel",
        "communication", "management", "marketing", "design"
    ]
    
    found_skills = [
        skill for skill in skills_keywords 
        if skill.lower() in text.lower()
    ]
    
    return {
        "email": email[0] if email else None,
        "phone": phone[0] if phone else None,
        "skills": found_skills,
        "raw_text": text[:500]
    }

def parse_cv(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif ext == ".docx":
        text = extract_text_from_docx(file_path)
    else:
        raise ValueError("Format non supporté. Utilisez PDF ou DOCX.")
    
    return extract_cv_info(text)
    