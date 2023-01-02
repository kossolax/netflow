from flask import Flask, request
from flask_cors import CORS
from flask_compress import Compress

import os
import subprocess
import json
import xmltodict
import re
import sys

DEFAULT_PORT = "8080"

illegal_unichrs = [ (0x00, 0x08), (0x0B, 0x0C), (0x0E, 0x1F), (0x7F, 0x84), (0x86, 0x9F), (0xFDD0, 0xFDDF), (0xFFFE, 0xFFFF)]

if sys.maxunicode >= 0x10000:  # not narrow build
  illegal_unichrs.extend([(0x1FFFE, 0x1FFFF), (0x2FFFE, 0x2FFFF), (0x3FFFE, 0x3FFFF), (0x4FFFE, 0x4FFFF),
                          (0x5FFFE, 0x5FFFF), (0x6FFFE, 0x6FFFF), (0x7FFFE, 0x7FFFF), (0x8FFFE, 0x8FFFF),
                          (0x9FFFE, 0x9FFFF), (0xAFFFE, 0xAFFFF), (0xBFFFE, 0xBFFFF), (0xCFFFE, 0xCFFFF),
                          (0xDFFFE, 0xDFFFF), (0xEFFFE, 0xEFFFF), (0xFFFFE, 0xFFFFF), (0x10FFFE, 0x10FFFF)
  ])

illegal_ranges = [fr'{chr(low)}-{chr(high)}' for (low, high) in illegal_unichrs]
xml_illegal_character_regex = '[' + ''.join(illegal_ranges) + ']'
illegal_xml_chars_re = re.compile(xml_illegal_character_regex)


app = Flask(__name__)
cors = CORS(app, origins=["http://localhost:4200", "https://cloud.netflow.dev"], expose_headers=["X-Auth-Token"])
app.config["COMPRESS_REGISTER"] = False
compress = Compress()
compress.init_app(app)

@app.route("/")
def root():
  return json.dumps({
    "message": "Hello World!"
  })

@app.route("/decode", methods=['POST'])
@compress.compressed()
def decode():
  try:

    print("Headers:")
    for i in request.headers:
      print(i)

    print("File list:")
    for i in request.files:
      print(i)


    if request.files.get('file') is None:
      return json.dumps({
        "message": "errored",
        "error": "no file provided"
      })

    file = request.files.get('file')
    ext = file.filename.split(".")[-1]

    if ext not in ["pkt", "pka"]:
      return json.dumps({
        "message": "errored",
        "error": "invalid file extension"
      })

    file_input = "input." + ext
    file.save(file_input)

    process = subprocess.Popen(["pka2xml", "-d", file_input, "output.xml"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    _, _ = process.communicate()

    with open("output.xml", mode="r") as file:
      clean = illegal_xml_chars_re.sub('', file.read())
      data_dict = xmltodict.parse(clean)
      return json.dumps(data_dict)

  except Exception as e:
    return json.dumps({
      "message": "errored",
      "error": str(e)
    })



if __name__ == "__main__":
  # Scaleway's system will inject a PORT environment variable on which your application should start the server.
  port_env =  os.getenv("PORT", DEFAULT_PORT)
  port = int(port_env)
  app.run(debug=False, host="0.0.0.0", port=port)
