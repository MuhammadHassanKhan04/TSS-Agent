import sys
import os
import json
from PIL import Image, ImageDraw, ImageFont
import qrcode

def generate_form(data_json_path, output_dir):
    try:
        # Load student data
        with open(data_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        student_id = data.get("studentId", "TSS-TEMP")
        
        # Paths
        template_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'forms', 'student-registration-template.png')
        if not os.path.exists(template_path):
            print(f"Error: Template not found at {template_path}")
            sys.exit(1)
            
        img = Image.open(template_path)
        draw = ImageDraw.Draw(img)
        
        # Load fonts
        try:
            font_path = "arial.ttf"
            font_regular = ImageFont.truetype(font_path, 10)
            font_bold = ImageFont.truetype(font_path, 10)
            font_small = ImageFont.truetype(font_path, 8)
        except IOError:
            font_regular = ImageFont.load_default()
            font_bold = ImageFont.load_default()
            font_small = ImageFont.load_default()
            
        # Helper text drawing function
        def text(x, y, val, bold=False):
            if val is not None:
                draw.text((x, y - 2), str(val), fill="black", font=font_bold if bold else font_regular)
                
        # Fill Form No & Date
        text(110, 248, student_id, bold=True)
        
        # Current Date
        created_at = data.get("createdAt", "")
        if created_at:
            from datetime import datetime
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        else:
            from datetime import datetime
            dt = datetime.now()
            
        day_str = dt.strftime("%d")
        month_str = dt.strftime("%m")
        year_str = dt.strftime("%y")
        
        text(532, 248, day_str)
        text(562, 248, month_str)
        text(612, 248, year_str)
        
        # 1. PERSONAL INFORMATION
        text(115, 309, data.get("fullName", ""))
        text(115, 332, data.get("fatherName", ""))
        
        # CNIC boxes
        cnic = "".join(filter(str.isdigit, data.get("cnic", "")))
        if len(cnic) >= 13:
            # First 5 boxes
            for i in range(5):
                text(126 + i * 13, 353, cnic[i], bold=True)
            # Next 7 boxes
            for i in range(7):
                text(206 + i * 13, 353, cnic[5+i], bold=True)
            # Last box
            text(315, 353, cnic[12], bold=True)
            
        # DOB
        dob_raw = data.get("dob", "")
        # Expecting format YYYY-MM-DD or DD-MM-YYYY
        dob_parts = dob_raw.split("-")
        if len(dob_parts) == 3:
            # If YYYY-MM-DD
            if len(dob_parts[0]) == 4:
                dob_y, dob_m, dob_d = dob_parts[0], dob_parts[1], dob_parts[2]
            else: # If DD-MM-YYYY
                dob_d, dob_m, dob_y = dob_parts[0], dob_parts[1], dob_parts[2]
            text(195, 376, dob_d)
            text(245, 376, dob_m)
            text(295, 376, dob_y)
            
        # Gender
        gender = data.get("gender", "").lower()
        if "female" in gender:
            text(174, 404, "X", bold=True)
        else: # Default or male
            text(122, 404, "X", bold=True)
            
        text(115, 426, data.get("nationality", "Pakistani"))
        text(115, 449, data.get("religion", "Islam"))
        
        text(485, 309, data.get("phone", ""))
        text(485, 332, data.get("whatsapp", ""))
        text(485, 355, data.get("email", ""))
        
        # Address split into two lines
        addr = data.get("address", "")
        if len(addr) > 35:
            text(485, 378, addr[:35])
            text(485, 402, addr[35:])
        else:
            text(485, 378, addr)
            
        text(485, 426, data.get("city", ""))
        text(485, 449, data.get("postalCode", ""))
        
        # 2. ACADEMIC INFORMATION
        text(145, 505, data.get("qualification", ""))
        text(145, 528, data.get("school", ""))
        text(145, 551, data.get("passingYear", ""))
        text(145, 574, data.get("marks", ""))
        
        # 3. COURSE INFORMATION
        text(485, 505, data.get("course", ""))
        
        # Batch Timing checkboxes
        # Options: Morning, Afternoon, Evening, Weekend
        batch = data.get("batch", "").lower()
        if "morning" in batch:
            text(391, 537, "X", bold=True)
        elif "afternoon" in batch:
            text(451, 537, "X", bold=True)
        elif "evening" in batch:
            text(516, 537, "X", bold=True)
        elif "weekend" in batch:
            text(574, 537, "X", bold=True)
            
        # Preferred Days checkboxes
        # Mon, Tue, Wed, Thu, Fri, Sat, Sun
        pref_days = data.get("preferredDays", "")
        # Normalize: can be "Mon, Tue" or array
        if isinstance(pref_days, list):
            pref_days = ",".join(pref_days)
        pref_days = pref_days.lower()
        
        days_map = {
            "mon": (391, 564),
            "tue": (430, 564),
            "wed": (469, 564),
            "thu": (505, 564),
            "fri": (544, 564),
            "sat": (583, 564),
            "sun": (622, 564)
        }
        for day_key, coords in days_map.items():
            if day_key in pref_days:
                text(coords[0], coords[1], "X", bold=True)
                
        text(485, 579, data.get("reference", "Social Media"))
        
        # 4. EMERGENCY CONTACT
        text(150, 634, data.get("emergencyName", ""))
        text(420, 634, data.get("relationship", ""))
        text(110, 654, data.get("emergencyPhone", ""))
        text(460, 654, data.get("alternatePhone", ""))
        
        emergency_addr = data.get("emergencyAddress", "")
        if len(emergency_addr) > 50:
            text(100, 674, emergency_addr[:50])
        else:
            text(100, 674, emergency_addr)
            
        # 5. OVERLAYS (QR CODE & PHOTO PLACEHOLDER)
        
        # Photo Placeholder Box (Top Right, inside building image block)
        # Dimensions: 80x100 pixels
        px, py = 570, 95
        draw.rectangle([(px, py), (px + 80, py + 95)], outline="black", fill="white", width=1)
        # Draw dotted text inside placeholder
        draw.text((px + 12, py + 30), "PASSPORT", fill="grey", font=font_small)
        draw.text((px + 23, py + 42), "SIZE", fill="grey", font=font_small)
        draw.text((px + 12, py + 54), "PHOTO", fill="grey", font=font_small)
        
        # QR Code Generation
        # Contains student ID and registration details
        qr_content = f"StudentID: {student_id}\nName: {data.get('fullName', '')}\nCourse: {data.get('course', '')}"
        qr = qrcode.QRCode(version=1, box_size=1, border=1)
        qr.add_data(qr_content)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white")
        qr_img = qr_img.resize((55, 55))
        
        # Overlay QR Code between Form No & Date
        img.paste(qr_img, (315, 215))
        
        # Save filled image
        os.makedirs(output_dir, exist_ok=True)
        png_filename = f"TSS_Registration_{student_id}.png"
        png_path = os.path.join(output_dir, png_filename)
        img.save(png_path)
        print(f"Generated Image: {png_path}")
        
        # Convert filled image directly to PDF for 100% exact design alignment
        pdf_filename = f"TSS_Registration_{student_id}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)
        
        pdf_img = img.convert('RGB')
        # A4 portrait resolution is handled cleanly by converting DPI
        pdf_img.save(pdf_path, "PDF", resolution=100.0)
        print(f"Generated PDF: {pdf_path}")
        
        # Return generated filenames
        result = {
            "success": True,
            "png": png_filename,
            "pdf": pdf_filename,
            "pngPath": png_path,
            "pdfPath": pdf_path
        }
        print(json.dumps(result))
        
    except Exception as e:
        import traceback
        result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python form_generator.py <data_json_path> <output_dir>")
        sys.exit(1)
    generate_form(sys.argv[1], sys.argv[2])
