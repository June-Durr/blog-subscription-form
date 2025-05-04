// src/components/SubscriptionForm.js
import React, { useState } from "react";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import axios from "axios";

// Define validation schema
const validationSchema = Yup.object({
  name: Yup.string()
    .min(2, "Name must be at least 2 characters")
    .required("Name is required"),
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  phone: Yup.string()
    .matches(/^[0-9]{10}$/, "Phone number must be 10 digits")
    .required("Phone number is required"),
  package: Yup.string().required("Please select a package"),
});

// Define package options
const packageOptions = [
  { id: "basic", name: "Basic Package" },
  { id: "standard", name: "Standard Package" },
  { id: "premium", name: "Premium Package" },
];

const SubscriptionForm = () => {
  const [formStatus, setFormStatus] = useState({
    submitted: false,
    error: false,
    message: "",
  });

  const initialValues = {
    name: "",
    email: "",
    phone: "",
    package: "",
  };

  const handleSubmit = async (values, { setSubmitting, resetForm }) => {
    try {
      // Get the API URL from environment variables or use default
      const apiUrl = process.env.REACT_APP_API_URL || "/api/subscribe";

      // Send form data to your serverless API endpoint
      await axios.post(apiUrl, values);

      setFormStatus({
        submitted: true,
        error: false,
        message:
          "Thank you for subscribing! You will receive a confirmation email shortly.",
      });
      resetForm();
    } catch (error) {
      setFormStatus({
        submitted: true,
        error: true,
        message:
          "Sorry, there was an error processing your subscription. Please try again.",
      });
      console.error("Submission error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="subscription-form-container">
      <h2>Subscribe to Our Blog</h2>

      {formStatus.submitted && (
        <div
          className={`status-message ${formStatus.error ? "error" : "success"}`}
        >
          {formStatus.message}
        </div>
      )}

      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <Field
                type="text"
                id="name"
                name="name"
                className="form-control"
              />
              <ErrorMessage
                name="name"
                component="div"
                className="error-message"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <Field
                type="email"
                id="email"
                name="email"
                className="form-control"
              />
              <ErrorMessage
                name="email"
                component="div"
                className="error-message"
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <Field
                type="text"
                id="phone"
                name="phone"
                className="form-control"
              />
              <ErrorMessage
                name="phone"
                component="div"
                className="error-message"
              />
            </div>

            <div className="form-group">
              <label htmlFor="package">Select Package</label>
              <Field
                as="select"
                id="package"
                name="package"
                className="form-control"
              >
                <option value="">Select a package</option>
                {packageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Field>
              <ErrorMessage
                name="package"
                component="div"
                className="error-message"
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Subscribe"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SubscriptionForm;
