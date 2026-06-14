import os
from PIL import Image, ImageDraw, ImageFont

def test_fill():
    template_path = 'assets/forms/student-registration-template.png'
    output_path = r'C:\Users\ALI COMPUTERS\Desktop\TSS - Agent\assets\forms\test_filled.png'
    
    if not os.path.exists(template_path):
        print("Template path not found!")
        return
        
    img = Image.open(template_path)
    draw = ImageDraw.Draw(img)
    
    # Load fonts
    try:
        font_regular = ImageFont.truetype("arial.ttf", 10)
        font_bold = ImageFont.truetype("arial.ttf", 10)
    except IOError:
        font_regular = ImageFont.load_default()
        font_bold = ImageFont.load_default()
        
    # Helper to draw text
    # Removed the y - 5 offset so the baseline aligns correctly
    def text(x, y, val, bold=False):
        draw.text((x, y - 2), str(val), fill="black", font=font_bold if bold else font_regular)
        
    # Form No & Date
    text(110, 248, "TSS-2026-0001", bold=True)
    # Date split
    text(532, 248, "13") # Day
    text(562, 248, "06") # Month
    text(612, 248, "26") # Year
    
    # Personal Info
    text(115, 309, "Muhammad Ahmed")
    text(115, 332, "Abdul Rehman")
    
    # CNIC (5 - 7 - 1 digits)
    cnic_digits = "4210112345679"
    # Block 1: 5 digits
    for i in range(5):
        text(126 + i * 13, 353, cnic_digits[i], bold=True)
    # Block 2: 7 digits
    for i in range(7):
        text(206 + i * 13, 353, cnic_digits[5+i], bold=True)
    # Block 3: 1 digit
    text(315, 353, cnic_digits[12], bold=True)
    
    # Date of Birth
    text(182, 376, "15") # Day
    text(212, 376, "08") # Month
    text(258, 376, "2002") # Year
    
    # Gender (Male)
    text(122, 404, "X", bold=True) # Male checkbox is at x=122, y=404. Female is at x=174, y=404
    
    text(115, 426, "Pakistani")
    text(115, 449, "Islam")
    
    text(485, 309, "+92 300 1234567")
    text(485, 332, "+92 300 7654321")
    text(485, 355, "ahmed.student@gmail.com")
    
    # Address
    text(485, 378, "A-123, Block 13-D, Gulshan-e-Iqbal")
    text(485, 402, "Near Federal Urdu University")
    
    text(485, 426, "Karachi")
    text(485, 449, "75300")
    
    # Academic Info
    text(145, 505, "Intermediate (Pre-Engineering)")
    text(145, 528, "Govt. Degree Science College")
    text(145, 551, "2024")
    text(145, 574, "850 / 1100 (A Grade)")
    
    # Course Info
    text(485, 505, "Full Stack Web Development")
    
    # Batch Timing (Weekend)
    text(574, 537, "X", bold=True) # Weekend checkbox is at x=574, y=537
    
    # Preferred Days (Sat, Sun)
    text(583, 564, "X", bold=True) # Sat (583, 564)
    text(622, 564, "X", bold=True) # Sun (622, 564)
    
    text(485, 579, "Social Media (Facebook)")
    
    # Emergency Contact
    text(150, 634, "Abdul Rehman")
    text(420, 634, "Father")
    text(110, 654, "+92 321 9876543")
    text(460, 654, "+92 322 1234567")
    text(100, 674, "A-123, Block 13-D, Gulshan-e-Iqbal, Karachi")
    
    # Save image
    img.save(output_path)
    print("Test filled image saved to", output_path)

if __name__ == '__main__':
    test_fill()
